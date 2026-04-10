import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Dict, Optional

router = APIRouter(prefix="/feedback", tags=["feedback"])

# Team members who will receive feedback
TEAM_EMAILS = [
    "abhilashnagamalla35@gmail.com",
    "berantejakolluri@gmail.com",
    "battujayanth2456@gmail.com",
]

class FeedbackData(BaseModel):
    ratings: Dict[str, int]
    comments: Optional[str] = ""
    timestamp: str

def send_feedback_email(feedback_data: FeedbackData, user_email: Optional[str] = None):
    """Send feedback email to team members"""
    try:
        # Get email credentials from environment
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("SENDER_EMAIL", "")
        sender_password = os.getenv("SENDER_PASSWORD", "")
        
        if not sender_email or not sender_password:
            print("Warning: SMTP credentials not configured. Skipping email sending.")
            return False
        
        # Prepare email content
        subject = "New Feedback Submitted - Intelligent Data Hub"
        
        ratings_html = "<br>".join([
            f"<strong>{key.replace('_', ' ').title()}:</strong> {rating}/5"
            for key, rating in feedback_data.ratings.items()
        ])
        
        body = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
                    .ratings {{ background-color: #f9f9f9; padding: 15px; border-left: 4px solid #000; margin: 15px 0; }}
                    .comments {{ background-color: #f9f9f9; padding: 15px; border-left: 4px solid #000; margin: 15px 0; }}
                    .footer {{ font-size: 12px; color: #666; margin-top: 20px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>New User Feedback Received</h2>
                    </div>
                    
                    <p><strong>Submission Time:</strong> {feedback_data.timestamp}</p>
                    {f'<p><strong>User Email:</strong> {user_email}</p>' if user_email else ''}
                    
                    <h3>Ratings</h3>
                    <div class="ratings">
                        {ratings_html}
                    </div>
                    
                    {f'''<h3>Comments</h3>
                    <div class="comments">
                        {feedback_data.comments}
                    </div>''' if feedback_data.comments else ''}
                    
                    <div class="footer">
                        <p>This is an automated email from Intelligent Data Hub feedback system.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        # Send email to each team member
        for recipient_email in TEAM_EMAILS:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = sender_email
                msg["To"] = recipient_email
                
                msg.attach(MIMEText(body, "html"))
                
                with smtplib.SMTP(smtp_server, smtp_port) as server:
                    server.starttls()
                    server.login(sender_email, sender_password)
                    server.send_message(msg)
                    
                print(f"Feedback email sent to {recipient_email}")
            except Exception as e:
                print(f"Error sending email to {recipient_email}: {str(e)}")
                continue
        
        return True
    except Exception as e:
        print(f"Error setting up email: {str(e)}")
        return False

@router.post("/")
async def submit_feedback(feedback: FeedbackData):
    """
    Submit user feedback
    
    Receives feedback ratings and comments, validates them,
    and sends the feedback to the team via email.
    """
    try:
        # Validate ratings are in range 0-5
        for key, rating in feedback.ratings.items():
            if not isinstance(rating, int) or rating < 0 or rating > 5:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid rating for {key}: must be between 0 and 5"
                )
        
        # Send email notification to team
        email_sent = send_feedback_email(feedback)
        
        # In a production app, you might also want to store the feedback in a database
        # For now, we'll just send the email and return success
        
        return {
            "success": True,
            "message": "Feedback submitted successfully",
            "email_notification_sent": email_sent
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing feedback: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error processing feedback submission"
        )

@router.get("/health")
async def feedback_health():
    """Health check endpoint"""
    return {"status": "ok", "service": "feedback"}
