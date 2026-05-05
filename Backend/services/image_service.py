import os

import requests


def normalize_picture_url(url: str) -> str:
    if "@WEB" in url:
        return url.split("@WEB", 1)[0]
    return url


def download_face_image(url: str, auth, save_dir: str, file_name: str):
    os.makedirs(save_dir, exist_ok=True)
    path = os.path.join(save_dir, file_name)

    response = requests.get(
        normalize_picture_url(url),
        auth=auth,
        timeout=30,
        stream=True,
    )

    if response.status_code != 200:
        return None

    with open(path, "wb") as file_handle:
        for chunk in response.iter_content(65536):
            if chunk:
                file_handle.write(chunk)

    return path
