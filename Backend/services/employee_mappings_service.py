import psycopg2
from datetime import datetime
import uuid
from typing import Optional, List
from db import get_db_connection


class EmployeeDeviceMappingService:
    @staticmethod
    def create_mapping(employee_id: uuid.UUID, card_id: str, device_serial_no: Optional[str] = None) -> dict:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO employee_device_mappings (employee_id, card_id, device_serial_no)
                VALUES (%s, %s, %s)
                RETURNING id, employee_id, card_id, device_serial_no, is_active, created_at
                """,
                (employee_id, card_id, device_serial_no)
            )
            result = cursor.fetchone()
            conn.commit()
            return {
                'id': result[0],
                'employee_id': result[1],
                'card_id': result[2],
                'device_serial_no': result[3],
                'is_active': result[4],
                'created_at': result[5]
            }
        except psycopg2.IntegrityError:
            conn.rollback()
            raise ValueError("Mapping already exists")
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_mapping_by_card_id(card_id: str) -> Optional[dict]:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id, employee_id, card_id, device_serial_no, is_active, created_at
                FROM employee_device_mappings
                WHERE card_id = %s AND is_active = TRUE
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (card_id,)
            )
            result = cursor.fetchone()
            if result:
                return {
                    'id': result[0],
                    'employee_id': result[1],
                    'card_id': result[2],
                    'device_serial_no': result[3],
                    'is_active': result[4],
                    'created_at': result[5]
                }
            return None
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_mappings_by_employee(employee_id: uuid.UUID) -> List[dict]:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id, employee_id, card_id, device_serial_no, is_active, created_at
                FROM employee_device_mappings
                WHERE employee_id = %s
                ORDER BY created_at DESC
                """,
                (employee_id,)
            )
            results = cursor.fetchall()
            return [
                {
                    'id': row[0],
                    'employee_id': row[1],
                    'card_id': row[2],
                    'device_serial_no': row[3],
                    'is_active': row[4],
                    'created_at': row[5]
                }
                for row in results
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def update_mapping(mapping_id: uuid.UUID, card_id: Optional[str] = None,
                      device_serial_no: Optional[str] = None, is_active: Optional[bool] = None) -> Optional[dict]:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            updates = []
            params = []
            if card_id is not None:
                updates.append("card_id = %s")
                params.append(card_id)
            if device_serial_no is not None:
                updates.append("device_serial_no = %s")
                params.append(device_serial_no)
            if is_active is not None:
                updates.append("is_active = %s")
                params.append(is_active)

            if not updates:
                return None

            params.append(mapping_id)
            cursor.execute(
                f"""
                UPDATE employee_device_mappings
                SET {', '.join(updates)}
                WHERE id = %s
                RETURNING id, employee_id, card_id, device_serial_no, is_active, created_at
                """,
                params
            )
            result = cursor.fetchone()
            conn.commit()
            if result:
                return {
                    'id': result[0],
                    'employee_id': result[1],
                    'card_id': result[2],
                    'device_serial_no': result[3],
                    'is_active': result[4],
                    'created_at': result[5]
                }
            return None
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def delete_mapping(mapping_id: uuid.UUID) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "DELETE FROM employee_device_mappings WHERE id = %s",
                (mapping_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def find_employee_by_card(card_id: str) -> Optional[uuid.UUID]:
        mapping = EmployeeDeviceMappingService.get_mapping_by_card_id(card_id)
        if mapping:
            return mapping['employee_id']
        return None
