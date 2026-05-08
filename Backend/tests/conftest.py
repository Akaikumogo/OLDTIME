"""Test sozlamalari: Backend katalogini sys.path'ga qo'shamiz."""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Test'lar paytida JWT_SECRET_KEY topilmasligi xatoga olib kelmasligi uchun
os.environ.setdefault("JWT_SECRET_KEY", "x" * 64)
os.environ.setdefault("DB_PASSWORD", "test")  # Pool yaratilmaydi, lekin import xatoga uchramaydi
