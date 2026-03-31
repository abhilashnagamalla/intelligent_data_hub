from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import databases
import jwt
import datetime
import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import hashlib

load_dotenv()

DATABASE_URL = "sqlite:///./test.db"
JWT_SECRET = os.getenv("JWT_SECRET")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

def send_email(to_email, otp):
    from_email = EMAIL_USER
    subject = "Your OTP for Intelligent Data Hub Registration"
    body = f"Your OTP is: {otp}. It expires in 10 minutes."

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain'))

    print(f"[DEBUG] Attempting to send email to {to_email} from {from_email}")
    print(f"[DEBUG] Email credentials configured: {bool(EMAIL_USER and EMAIL_PASS)}")

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.set_debuglevel(1)
        server.starttls()
        server.login(from_email, EMAIL_PASS)
        text = msg.as_string()
        server.sendmail(from_email, to_email, text)
        server.quit()
        print(f"[SUCCESS] Email sent to {to_email}")
        return (True, "Email sent successfully")
    except smtplib.SMTPAuthenticationError as e:
        error_msg = f"Email authentication failed. Check EMAIL_USER and EMAIL_PASS: {str(e)}"
        print(f"[ERROR] {error_msg}")
        return (False, error_msg)
    except smtplib.SMTPException as e:
        error_msg = f"SMTP error: {str(e)}"
        print(f"[ERROR] {error_msg}")
        return (False, error_msg)
    except Exception as e:
        error_msg = f"Email send failed: {str(e)}"
        print(f"[ERROR] {error_msg}")
        return (False, error_msg)

database = databases.Database(DATABASE_URL)

class SendOTP(BaseModel):
    email: str
    username: str

class VerifyOTP(BaseModel):
    email: str
    otp: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

router = APIRouter()

@router.on_event("startup")
async def startup():
    await database.connect()

@router.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@router.post("/send-otp")
async def send_otp(user: SendOTP):
    # Only allow Gmail addresses for OTP-based registration
    if not user.email.lower().endswith("@gmail.com"):
        raise HTTPException(status_code=400, detail="Only Gmail addresses are supported for OTP at this time")

    # Check if email exists and whether it's already verified
    query = "SELECT id, verified FROM users WHERE email = :email"
    existing = await database.fetch_one(query, {"email": user.email})
    if existing and existing["verified"]:
        # Keep existing verified accounts and prevent duplicate registration
        raise HTTPException(status_code=400, detail="Email already registered. Please sign in instead.")

    # Check if username exists (only block if taken by a verified user)
    query = "SELECT id FROM users WHERE username = :username"
    existing = await database.fetch_one(query, {"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Generate OTP
    otp = ''.join(random.choices(string.digits, k=6))
    otp_expires = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

    # Insert or update user with OTP
    query = """
    INSERT INTO users (email, username, otp, otp_expires, verified)
    VALUES (:email, :username, :otp, :expires, FALSE)
    ON CONFLICT (email) DO UPDATE SET
        username = EXCLUDED.username,
        otp = EXCLUDED.otp,
        otp_expires = EXCLUDED.otp_expires,
        verified = FALSE
    """
    await database.execute(query, {"email": user.email, "username": user.username, "otp": otp, "expires": otp_expires})

    # Send OTP via email
    success, message = send_email(user.email, otp)
    if success:
        return {"message": "OTP sent to email"}
    else:
        # For testing/debugging - return OTP if email fails
        print(f"[WARNING] Email sending failed: {message}. Returning OTP for debugging.")
        return {
            "message": "Email sending failed. OTP shown below for testing.",
            "otp": otp,
            "debug_message": message
        }

@router.post("/verify-otp")
async def verify_otp(data: VerifyOTP):
    # Get user
    query = "SELECT id, otp, otp_expires FROM users WHERE email = :email"
    user = await database.fetch_one(query, {"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if datetime.datetime.utcnow() > user["otp_expires"]:
        raise HTTPException(status_code=400, detail="OTP expired")

    # Hash password
    hashed = hashlib.sha256(data.password.encode()).hexdigest()

    # Update user with password and verified
    query = "UPDATE users SET password_hash = :hash, verified = TRUE, otp = NULL, otp_expires = NULL WHERE id = :id"
    await database.execute(query, {"hash": hashed, "id": user["id"]})

    return {"message": "Account created successfully"}

@router.post("/login")
async def login(user: UserLogin):
    # Get user by email OR username
    query = "SELECT id, email, username, password_hash, verified FROM users WHERE email = :login OR username = :login"
    db_user = await database.fetch_one(query, {"login": user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email/username or password")

    if not db_user["verified"]:
        raise HTTPException(status_code=401, detail="Account not verified. Please complete registration.")

    # Verify password
    hashed = hashlib.sha256(user.password.encode()).hexdigest()
    if hashed != db_user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create JWT
    payload = {
        "user_id": db_user["id"],
        "email": db_user["email"],
        "username": db_user["username"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    return {"access_token": token, "token_type": "bearer"}

@router.post("/test-email")
async def test_email(data: dict):
    """Test endpoint to verify email configuration"""
    test_email_addr = data.get("email")
    if not test_email_addr:
        raise HTTPException(status_code=400, detail="Email address required")
    
    test_otp = "123456"
    success, message = send_email(test_email_addr, test_otp)
    
    if success:
        return {"success": True, "message": "Test email sent successfully"}
    else:
        return {
            "success": False,
            "error": message,
            "debug_info": "Check the backend console for detailed logs"
        }