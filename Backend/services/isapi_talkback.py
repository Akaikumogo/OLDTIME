"""ISAPI Two-way Audio (Talkback) Service"""
import requests
from db import get_connection
from services.ai_camera_service import camera_credential_secret, fetch_camera, inject_rtsp_credentials


def get_camera_isapi_url(camera_id: str) -> tuple[str, str, str]:
    """Get camera ISAPI base URL and credentials (IP, username, password)"""
    secret = camera_credential_secret()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ip, username,
                    CASE WHEN password_encrypted IS NULL THEN NULL
                    ELSE pgp_sym_decrypt(password_encrypted, %s) END
                FROM cameras WHERE id = %s
                """,
                (secret, camera_id),
            )
            row = cur.fetchone()

    if not row:
        raise ValueError(f"Camera {camera_id} not found")

    ip, username, password = row
    return f"http://{ip}", username or "", password or ""


def isapi_auth_headers(username: str, password: str) -> dict:
    """Create Basic Auth headers for ISAPI"""
    import base64
    credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {credentials}"}


def get_twoway_audio_channels(camera_id: str) -> list:
    """Get available two-way audio channels"""
    base_url, username, password = get_camera_isapi_url(camera_id)
    headers = isapi_auth_headers(username, password)

    try:
        response = requests.get(
            f"{base_url}/ISAPI/System/TwoWayAudio/channels",
            headers=headers,
            timeout=5,
        )
        response.raise_for_status()

        # Parse XML response
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.content)

        channels = []
        for channel in root.findall(".//TwoWayAudioChannel", {"": "http://www.hikvision.com/ver20/XMLSchema"}):
            channel_id = channel.find("id")
            enabled = channel.find("enabled")
            if channel_id is not None:
                channels.append({
                    "id": channel_id.text,
                    "enabled": enabled.text == "true" if enabled is not None else False,
                })

        return channels
    except Exception as exc:
        raise RuntimeError(f"Failed to get two-way audio channels: {exc}")


def open_twoway_audio(camera_id: str, channel_id: str = "1") -> bool:
    """Open two-way audio channel"""
    base_url, username, password = get_camera_isapi_url(camera_id)
    headers = isapi_auth_headers(username, password)

    xml_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<TwoWayAudioChannel>
  <id>{channel_id}</id>
  <enabled>true</enabled>
</TwoWayAudioChannel>
"""

    try:
        response = requests.put(
            f"{base_url}/ISAPI/System/TwoWayAudio/channels/{channel_id}/open",
            headers={**headers, "Content-Type": "application/xml"},
            data=xml_body,
            timeout=5,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        raise RuntimeError(f"Failed to open two-way audio: {exc}")


def close_twoway_audio(camera_id: str, channel_id: str = "1") -> bool:
    """Close two-way audio channel"""
    base_url, username, password = get_camera_isapi_url(camera_id)
    headers = isapi_auth_headers(username, password)

    try:
        response = requests.put(
            f"{base_url}/ISAPI/System/TwoWayAudio/channels/{channel_id}/close",
            headers=headers,
            timeout=5,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        raise RuntimeError(f"Failed to close two-way audio: {exc}")


def send_audio_data(camera_id: str, audio_data: bytes, channel_id: str = "1") -> bool:
    """Send audio data to camera speaker (G.711ulaw format)"""
    base_url, username, password = get_camera_isapi_url(camera_id)
    headers = isapi_auth_headers(username, password)

    try:
        response = requests.put(
            f"{base_url}/ISAPI/System/TwoWayAudio/channels/{channel_id}/audioData",
            headers={**headers, "Content-Type": "audio/pcm"},
            data=audio_data,
            timeout=5,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        raise RuntimeError(f"Failed to send audio data: {exc}")


def receive_audio_stream(camera_id: str, channel_id: str = "1") -> requests.Response:
    """Get audio stream from camera"""
    base_url, username, password = get_camera_isapi_url(camera_id)
    headers = isapi_auth_headers(username, password)

    try:
        response = requests.get(
            f"{base_url}/ISAPI/System/TwoWayAudio/channels/{channel_id}/audioData",
            headers=headers,
            timeout=None,  # Stream, no timeout
            stream=True,
        )
        response.raise_for_status()
        return response
    except Exception as exc:
        raise RuntimeError(f"Failed to receive audio stream: {exc}")
