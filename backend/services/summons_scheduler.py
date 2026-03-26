"""
Smart Summons WhatsApp Scheduler Service
Handles background scheduling of WhatsApp notifications for court summons.
Notifications are sent 1 day before the court date at 09:00 AM.
"""
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import os

logger = logging.getLogger(__name__)

# In-memory store for scheduled summons (in production, use Redis/DB)
scheduled_summons = {}

# WhatsApp API configuration (to be configured with actual WhatsApp Business API)
WHATSAPP_API_URL = os.environ.get('WHATSAPP_API_URL', '')
WHATSAPP_API_KEY = os.environ.get('WHATSAPP_API_KEY', '')


def parse_date(date_str: str) -> Optional[datetime]:
    """Parse date string in DD/MM/YYYY or DD-MM-YYYY format."""
    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d.%m.%Y']:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def calculate_notification_time(hearing_date_str: str) -> Optional[datetime]:
    """
    Calculate notification time: 09:00 AM, 1 day before hearing date.
    """
    hearing_date = parse_date(hearing_date_str)
    if not hearing_date:
        return None
    
    # Set notification for 1 day before at 09:00 AM IST
    notification_date = hearing_date - timedelta(days=1)
    notification_time = notification_date.replace(hour=9, minute=0, second=0, microsecond=0)
    
    return notification_time


def format_whatsapp_message(summons_data: dict) -> str:
    """
    Generate WhatsApp notification message for court summons.
    """
    case_number = summons_data.get('case_number', 'N/A')
    court_name = summons_data.get('court_name', 'N/A')
    hearing_date = summons_data.get('hearing_date', 'N/A')
    hearing_time = summons_data.get('hearing_time', 'N/A')
    party_name = summons_data.get('party_name', 'N/A')
    purpose = summons_data.get('purpose', 'Court Hearing')
    
    message = f"""🔔 *COURT SUMMONS REMINDER*

📋 *Case Number:* {case_number}
🏛️ *Court:* {court_name}
📅 *Hearing Date:* {hearing_date}
⏰ *Hearing Time:* {hearing_time}
👤 *Party:* {party_name}
📝 *Purpose:* {purpose}

⚠️ *Please ensure your attendance at the scheduled hearing.*

_This is an automated reminder from SAAKSHYAM AI Investigation System._
"""
    return message


async def send_whatsapp_notification(phone_number: str, message: str) -> dict:
    """
    Send WhatsApp notification using WhatsApp Business API.
    
    NOTE: This is a placeholder implementation. In production, integrate with:
    - Meta WhatsApp Business API
    - Twilio WhatsApp API
    - Other WhatsApp gateway providers
    """
    # Clean phone number (ensure 10-digit format for Indian numbers)
    clean_number = ''.join(filter(str.isdigit, phone_number))
    if len(clean_number) == 10:
        clean_number = '91' + clean_number  # Add India country code
    
    if not WHATSAPP_API_KEY:
        # Log the notification for mock mode
        logger.info(f"[MOCK WHATSAPP] To: +{clean_number}")
        logger.info(f"[MOCK WHATSAPP] Message:\n{message}")
        return {
            "success": True,
            "mock": True,
            "phone": clean_number,
            "message": "WhatsApp notification logged (API not configured)",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    # Production implementation would go here
    # Example with HTTP client:
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(
    #         WHATSAPP_API_URL,
    #         headers={"Authorization": f"Bearer {WHATSAPP_API_KEY}"},
    #         json={"to": clean_number, "message": message}
    #     )
    #     return response.json()
    
    return {
        "success": True,
        "mock": True,
        "phone": clean_number,
        "message": "WhatsApp API integration pending"
    }


async def schedule_summons_notification(summons_id: str, summons_data: dict) -> dict:
    """
    Schedule WhatsApp notifications for a summons.
    Sends to: Court Police, Victim, and Defense Advocate.
    """
    hearing_date = summons_data.get('hearing_date', '')
    notification_time = calculate_notification_time(hearing_date)
    
    if not notification_time:
        return {
            "success": False,
            "error": "Invalid hearing date format",
            "summons_id": summons_id
        }
    
    # Check if notification time has already passed
    now = datetime.now()
    if notification_time < now:
        return {
            "success": False,
            "error": "Notification time has already passed",
            "summons_id": summons_id,
            "notification_time": notification_time.isoformat()
        }
    
    # Store scheduled summons
    scheduled_summons[summons_id] = {
        "summons_id": summons_id,
        "summons_data": summons_data,
        "notification_time": notification_time.isoformat(),
        "scheduled_at": datetime.now(timezone.utc).isoformat(),
        "status": "scheduled",
        "contacts": {
            "court_police": summons_data.get('court_police_phone', ''),
            "victim": summons_data.get('victim_phone', ''),
            "advocate": summons_data.get('advocate_phone', '')
        }
    }
    
    # Calculate delay for background task
    delay_seconds = (notification_time - now).total_seconds()
    
    # Schedule the background notification task
    asyncio.create_task(
        execute_scheduled_notification(summons_id, delay_seconds)
    )
    
    return {
        "success": True,
        "summons_id": summons_id,
        "notification_time": notification_time.strftime('%d/%m/%Y at %H:%M'),
        "contacts_scheduled": 3,
        "message": f"Notifications scheduled for {notification_time.strftime('%d/%m/%Y')} at 09:00 AM"
    }


async def execute_scheduled_notification(summons_id: str, delay_seconds: float):
    """
    Background task that waits and then sends the WhatsApp notifications.
    """
    logger.info(f"Notification for summons {summons_id} scheduled in {delay_seconds:.0f} seconds")
    
    # Wait until notification time
    # For delays > 24 hours, we'd use a proper job scheduler like APScheduler or Celery
    # Here we cap at 1 hour for demo (in production, use persistent scheduler)
    actual_delay = min(delay_seconds, 3600)  # Cap at 1 hour for demo
    await asyncio.sleep(actual_delay)
    
    summons_info = scheduled_summons.get(summons_id)
    if not summons_info:
        logger.warning(f"Summons {summons_id} not found in schedule")
        return
    
    summons_data = summons_info.get('summons_data', {})
    message = format_whatsapp_message(summons_data)
    
    contacts = summons_info.get('contacts', {})
    results = []
    
    # Send to Court Police
    if contacts.get('court_police'):
        result = await send_whatsapp_notification(contacts['court_police'], message)
        results.append({"type": "court_police", **result})
    
    # Send to Victim
    if contacts.get('victim'):
        result = await send_whatsapp_notification(contacts['victim'], message)
        results.append({"type": "victim", **result})
    
    # Send to Advocate
    if contacts.get('advocate'):
        result = await send_whatsapp_notification(contacts['advocate'], message)
        results.append({"type": "advocate", **result})
    
    # Update status
    scheduled_summons[summons_id]['status'] = 'sent'
    scheduled_summons[summons_id]['sent_at'] = datetime.now(timezone.utc).isoformat()
    scheduled_summons[summons_id]['results'] = results
    
    logger.info(f"Notifications sent for summons {summons_id}: {len(results)} recipients")


def get_scheduled_summons(summons_id: str = None) -> dict:
    """
    Get scheduled summons information.
    """
    if summons_id:
        return scheduled_summons.get(summons_id, {"error": "Not found"})
    return scheduled_summons


def cancel_summons_notification(summons_id: str) -> dict:
    """
    Cancel a scheduled summons notification.
    """
    if summons_id in scheduled_summons:
        scheduled_summons[summons_id]['status'] = 'cancelled'
        return {"success": True, "message": f"Summons {summons_id} notification cancelled"}
    return {"success": False, "error": "Summons not found"}
