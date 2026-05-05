ALLOWED_ADMIN_SORT_FIELDS = {
    "id": "id",
    "full_name": "full_name",
    "username": "username",
    "email": "email",
    "role": "role",
    "created_at": "created_at",
}

ALLOWED_SORT_ORDERS = {"asc", "desc"}


def serialize_admin(row):
    return {
        "id": str(row[0]),
        "full_name": row[1],
        "username": row[2],
        "email": row[3],
        "role": row[4],
        "is_active": row[5],
        "created_at": str(row[6]),
    }
