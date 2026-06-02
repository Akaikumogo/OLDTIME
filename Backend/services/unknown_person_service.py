"""
Unknown person management service
Noma'lum shaxslarni employee'larga linklay, tarihini qayta yuklash
"""
import logging
from datetime import datetime
from typing import Optional
from psycopg2.extras import Json
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def find_or_create_unknown_person(
    cur,
    cluster_id: str,
    embedding: list[float],
    snapshot_path: Optional[str] = None,
    confidence: float = 0.0,
):
    """
    Yuzning embedding'i bilan noma'lum shaxsni topish yoki yaratish
    cluster_id: FaceNet512 embedding'i asosida klaster ID
    """
    cur.execute(
        """
        SELECT id, detection_count, linked_employee_id
        FROM unknown_persons
        WHERE cluster_id = %s
        """,
        (cluster_id,),
    )
    existing = cur.fetchone()

    if existing:
        # Mavjud unknown person: detection_count'ni +1 qilish
        unknown_id = str(existing[0])
        cur.execute(
            """
            UPDATE unknown_persons
            SET
                detection_count = detection_count + 1,
                last_seen_at = NOW(),
                primary_embedding = %s,
                sample_snapshot_path = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (embedding, snapshot_path, unknown_id),
        )
        return unknown_id, existing[2]  # (unknown_id, linked_employee_id)

    # Yangi unknown person yaratish
    cur.execute(
        """
        INSERT INTO unknown_persons (
            cluster_id,
            primary_embedding,
            sample_snapshot_path,
            detection_count,
            last_seen_at,
            is_active
        )
        VALUES (%s, %s, %s, 1, NOW(), TRUE)
        RETURNING id
        """,
        (cluster_id, embedding, snapshot_path),
    )
    unknown_id = str(cur.fetchone()[0])
    logger.info(f"✅ Unknown person created: {unknown_id}")
    return unknown_id, None


def link_unknown_to_employee(
    cur,
    unknown_person_id: str,
    employee_id: str,
    user_id: Optional[str] = None,
    reason: Optional[str] = None,
):
    """
    Noma'lum shaxsni employee'ga bog'lash va tarihni retroaktiv qayta yuklash

    Ish jarayoni:
    1. unknown_persons.linked_employee_id = employee_id
    2. camera_detection_events jadvali'nda shu cluster'dagi barcha detections'ni
       ushbu employee'ga bog'lash
    3. Audit trail'ga qayd qilish
    """
    # 1. Noma'lum shaxsning ma'lumotini topish
    cur.execute(
        """
        SELECT cluster_id, linked_employee_id, detection_count
        FROM unknown_persons
        WHERE id = %s
        """,
        (unknown_person_id,),
    )
    up_row = cur.fetchone()
    if not up_row:
        raise HTTPException(status_code=404, detail="Unknown person not found")

    cluster_id, old_employee_id, detection_count = up_row

    # Agar allaqachon linked bo'lsa, warning
    if old_employee_id:
        logger.warning(
            f"⚠️  Unknown person {unknown_person_id} already linked to {old_employee_id}. Re-linking to {employee_id}"
        )

    # 2. Barcha unknown detection'larni ushbu employee'ga bog'lash
    # (shu cluster_id'dagi, employee_id=NULL bo'lgan)
    cur.execute(
        """
        UPDATE camera_detection_events
        SET employee_id = %s, updated_at = NOW()
        WHERE employee_id IS NULL
          AND track_id IN (
            SELECT DISTINCT track_id
            FROM camera_detection_events
            WHERE snapshot_path LIKE %s
          )
        RETURNING COUNT(*)
        """,
        (employee_id, f"%{cluster_id}%"),
    )

    retroactive_count = cur.fetchone()[0] or 0

    # 3. Unknown person'ni employee'ga bog'lash
    cur.execute(
        """
        UPDATE unknown_persons
        SET
            linked_employee_id = %s,
            linked_at = NOW(),
            linked_by_user_id = %s,
            is_active = FALSE,
            updated_at = NOW()
        WHERE id = %s
        """,
        (employee_id, user_id, unknown_person_id),
    )

    # 4. Audit trail'ga qayd qilish
    action = "RELINKED" if old_employee_id else "LINKED"
    cur.execute(
        """
        INSERT INTO unknown_person_links_audit (
            unknown_person_id,
            employee_id,
            linked_by_user_id,
            action,
            reason,
            retroactive_count
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (unknown_person_id, employee_id, user_id, action, reason, retroactive_count),
    )

    logger.info(
        f"🔗 Unknown person {unknown_person_id} linked to employee {employee_id}. "
        f"Retroactively linked {retroactive_count} detections"
    )

    return {
        "unknown_person_id": unknown_person_id,
        "employee_id": employee_id,
        "action": action,
        "retroactive_count": retroactive_count,
    }


def unlink_unknown_from_employee(
    cur,
    unknown_person_id: str,
    user_id: Optional[str] = None,
    reason: Optional[str] = None,
):
    """Noma'lum shaxsni employee'dan ajratish"""
    cur.execute(
        """
        SELECT linked_employee_id FROM unknown_persons WHERE id = %s
        """,
        (unknown_person_id,),
    )
    row = cur.fetchone()
    if not row or not row[0]:
        raise HTTPException(status_code=400, detail="Unknown person is not linked")

    old_employee_id = str(row[0])

    # Unlink
    cur.execute(
        """
        UPDATE unknown_persons
        SET
            linked_employee_id = NULL,
            linked_at = NULL,
            linked_by_user_id = NULL,
            is_active = TRUE,
            updated_at = NOW()
        WHERE id = %s
        """,
        (unknown_person_id,),
    )

    # Audit
    cur.execute(
        """
        INSERT INTO unknown_person_links_audit (
            unknown_person_id,
            employee_id,
            linked_by_user_id,
            action,
            reason
        )
        VALUES (%s, %s, %s, 'UNLINKED', %s)
        """,
        (unknown_person_id, old_employee_id, user_id, reason),
    )

    logger.info(f"🔓 Unknown person {unknown_person_id} unlinked from {old_employee_id}")

    return {
        "unknown_person_id": unknown_person_id,
        "unlinked_from_employee_id": old_employee_id,
    }


def list_unlinked_unknown_persons(cur, limit: int = 100, offset: int = 0):
    """Hali employee'ga bog'lanmagan unknown persons'ni ro'yxatini olish"""
    cur.execute(
        """
        SELECT COUNT(*)
        FROM unknown_persons
        WHERE linked_employee_id IS NULL AND is_active = TRUE
        """,
    )
    total = cur.fetchone()[0]

    cur.execute(
        """
        SELECT
            id,
            cluster_id,
            detection_count,
            last_seen_at,
            sample_snapshot_path,
            created_at
        FROM unknown_persons
        WHERE linked_employee_id IS NULL AND is_active = TRUE
        ORDER BY last_seen_at DESC
        LIMIT %s OFFSET %s
        """,
        (limit, offset),
    )

    return total, [
        {
            "id": str(row[0]),
            "cluster_id": row[1],
            "detection_count": row[2],
            "last_seen_at": str(row[3]),
            "sample_snapshot": row[4],
            "created_at": str(row[5]),
        }
        for row in cur.fetchall()
    ]


def get_unknown_person_details(cur, unknown_person_id: str):
    """Unknown person'ning detallari: nechta marotaba ko'rilgani, qaysi kamerada, va hokazо"""
    cur.execute(
        """
        SELECT
            up.id,
            up.cluster_id,
            up.detection_count,
            up.last_seen_at,
            up.sample_snapshot_path,
            up.created_at,
            up.linked_employee_id
        FROM unknown_persons up
        WHERE up.id = %s
        """,
        (unknown_person_id,),
    )
    up_row = cur.fetchone()
    if not up_row:
        raise HTTPException(status_code=404, detail="Unknown person not found")

    # Detections'ni olish
    cur.execute(
        """
        SELECT
            cde.id,
            c.name as camera_name,
            z.name as zone_name,
            cde.seen_at,
            cde.confidence,
            cde.snapshot_path
        FROM camera_detection_events cde
        JOIN cameras c ON c.id = cde.camera_id
        JOIN zones z ON z.id = cde.zone_id
        WHERE cde.employee_id IS NULL
          AND cde.snapshot_path LIKE %s
        ORDER BY cde.seen_at DESC
        LIMIT 50
        """,
        (f"%{up_row[1]}%",),
    )

    detections = [
        {
            "id": str(row[0]),
            "camera_name": row[1],
            "zone_name": row[2],
            "seen_at": str(row[3]),
            "confidence": float(row[4]),
            "snapshot_path": row[5],
        }
        for row in cur.fetchall()
    ]

    return {
        "id": str(up_row[0]),
        "cluster_id": up_row[1],
        "detection_count": up_row[2],
        "last_seen_at": str(up_row[3]),
        "sample_snapshot": up_row[4],
        "created_at": str(up_row[5]),
        "linked_employee_id": str(up_row[6]) if up_row[6] else None,
        "recent_detections": detections,
    }
