import boto3
import os
from botocore.exceptions import NoCredentialsError
import uuid

def upload_file_to_s3(file_obj, object_name=None):
    """上傳檔案到 S3 並回傳公開 URL"""
    bucket_name = os.getenv("AWS_BUCKET_NAME")
    region = os.getenv("AWS_REGION")
    
    # 如果沒有指定檔名，隨機生成一個 UUID 檔名
    if object_name is None:
        extension = file_obj.filename.split(".")[-1]
        object_name = f"{uuid.uuid4()}.{extension}"

    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=region
    )

    try:
        # 上傳檔案
        s3_client.upload_fileobj(
            file_obj.file, 
            bucket_name, 
            object_name,
            ExtraArgs={'ContentType': file_obj.content_type} # 設定 Content-Type 讓瀏覽器能直接預覽
        )
        # 產生 URL
        url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{object_name}"
        return url
    except NoCredentialsError:
        print("Credentials not available")
        return None
    except Exception as e:
        print(f"S3 Upload Error: {e}")
        return None
