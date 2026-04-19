"""
Translation Usage Tracking Service
===================================
Tracks all translation API calls for cost monitoring and reporting.
Stores daily and monthly aggregates for the Admin Dashboard.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Database connection
_db = None

def get_db():
    global _db
    if _db is None:
        client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
        _db = client[os.environ.get('DB_NAME', 'test_database')]
    return _db


# Cost per character (approximate)
TRANSLATION_COST_PER_CHAR = 0.00002  # $0.02 per 1000 characters
LLM_COST_PER_1K_TOKENS = 0.002  # GPT-5.2 cost


async def log_translation_usage(
    officer_id: str,
    operation: str,
    source_language: str,
    target_language: str,
    char_count: int,
    token_count: int = 0,
    api_provider: str = "google",
    cached: bool = False,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Log a translation API call.
    
    Args:
        officer_id: ID of the officer making the request
        operation: Type of operation (translate, llm_translate, entity_extraction)
        source_language: Source language code
        target_language: Target language code
        char_count: Number of characters processed
        token_count: Number of tokens (for LLM calls)
        api_provider: API provider (google, emergent_llm)
        cached: Whether result was served from cache
        metadata: Additional metadata
    """
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y-%m-%d")
        month_str = now.strftime("%Y-%m")
        
        # Calculate cost
        if api_provider == "google":
            cost = char_count * TRANSLATION_COST_PER_CHAR
        else:  # LLM
            cost = (token_count / 1000) * LLM_COST_PER_1K_TOKENS
        
        # If cached, cost is 0
        if cached:
            cost = 0
        
        # Log individual usage
        usage_entry = {
            "officer_id": officer_id,
            "operation": operation,
            "source_language": source_language,
            "target_language": target_language,
            "char_count": char_count,
            "token_count": token_count,
            "api_provider": api_provider,
            "cached": cached,
            "estimated_cost_usd": round(cost, 6),
            "metadata": metadata or {},
            "timestamp": now.isoformat(),
            "date": date_str,
            "month": month_str
        }
        
        await db.translation_usage.insert_one(usage_entry)
        
        # Update daily aggregate
        await db.translation_daily_stats.update_one(
            {"date": date_str},
            {
                "$inc": {
                    "total_requests": 1,
                    "total_chars": char_count if not cached else 0,
                    "total_tokens": token_count if not cached else 0,
                    "cached_requests": 1 if cached else 0,
                    "estimated_cost_usd": cost,
                    f"by_operation.{operation}": 1,
                    f"by_language.{source_language}": 1,
                    f"by_officer.{officer_id}": 1
                },
                "$setOnInsert": {"created_at": now.isoformat()}
            },
            upsert=True
        )
        
        # Update monthly aggregate
        await db.translation_monthly_stats.update_one(
            {"month": month_str},
            {
                "$inc": {
                    "total_requests": 1,
                    "total_chars": char_count if not cached else 0,
                    "total_tokens": token_count if not cached else 0,
                    "cached_requests": 1 if cached else 0,
                    "estimated_cost_usd": cost,
                    f"by_operation.{operation}": 1,
                    f"by_language.{source_language}": 1
                },
                "$setOnInsert": {"created_at": now.isoformat()}
            },
            upsert=True
        )
        
        logger.info(f"Logged translation usage: {operation}, {char_count} chars, ${cost:.4f}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to log translation usage: {e}")
        return False


async def get_daily_usage(date: Optional[str] = None) -> Dict[str, Any]:
    """Get usage stats for a specific date (default: today)."""
    try:
        db = get_db()
        if date is None:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        stats = await db.translation_daily_stats.find_one(
            {"date": date},
            {"_id": 0}
        )
        
        return stats or {
            "date": date,
            "total_requests": 0,
            "total_chars": 0,
            "total_tokens": 0,
            "cached_requests": 0,
            "estimated_cost_usd": 0,
            "by_operation": {},
            "by_language": {},
            "by_officer": {}
        }
        
    except Exception as e:
        logger.error(f"Failed to get daily usage: {e}")
        return {"error": str(e)}


async def get_monthly_usage(month: Optional[str] = None) -> Dict[str, Any]:
    """Get usage stats for a specific month (default: current month)."""
    try:
        db = get_db()
        if month is None:
            month = datetime.now(timezone.utc).strftime("%Y-%m")
        
        stats = await db.translation_monthly_stats.find_one(
            {"month": month},
            {"_id": 0}
        )
        
        return stats or {
            "month": month,
            "total_requests": 0,
            "total_chars": 0,
            "total_tokens": 0,
            "cached_requests": 0,
            "estimated_cost_usd": 0,
            "by_operation": {},
            "by_language": {}
        }
        
    except Exception as e:
        logger.error(f"Failed to get monthly usage: {e}")
        return {"error": str(e)}


async def get_usage_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    officer_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get detailed usage report for date range.
    
    Args:
        start_date: Start date (YYYY-MM-DD), default: 30 days ago
        end_date: End date (YYYY-MM-DD), default: today
        officer_id: Filter by specific officer
    """
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        
        if end_date is None:
            end_date = now.strftime("%Y-%m-%d")
        if start_date is None:
            start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Build query
        query = {
            "date": {"$gte": start_date, "$lte": end_date}
        }
        if officer_id:
            query["officer_id"] = officer_id
        
        # Get daily breakdown
        daily_stats = await db.translation_daily_stats.find(
            {"date": {"$gte": start_date, "$lte": end_date}},
            {"_id": 0}
        ).sort("date", 1).to_list(100)
        
        # Calculate totals
        totals = {
            "total_requests": 0,
            "total_chars": 0,
            "total_tokens": 0,
            "cached_requests": 0,
            "estimated_cost_usd": 0
        }
        
        for day in daily_stats:
            totals["total_requests"] += day.get("total_requests", 0)
            totals["total_chars"] += day.get("total_chars", 0)
            totals["total_tokens"] += day.get("total_tokens", 0)
            totals["cached_requests"] += day.get("cached_requests", 0)
            totals["estimated_cost_usd"] += day.get("estimated_cost_usd", 0)
        
        totals["estimated_cost_usd"] = round(totals["estimated_cost_usd"], 2)
        
        # Calculate cache hit rate
        if totals["total_requests"] > 0:
            totals["cache_hit_rate"] = round(totals["cached_requests"] / totals["total_requests"] * 100, 1)
        else:
            totals["cache_hit_rate"] = 0
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "totals": totals,
            "daily_breakdown": daily_stats,
            "generated_at": now.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get usage report: {e}")
        return {"error": str(e)}


async def get_top_users(limit: int = 10, month: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get top users by translation usage."""
    try:
        db = get_db()
        if month is None:
            month = datetime.now(timezone.utc).strftime("%Y-%m")
        
        pipeline = [
            {"$match": {"month": month}},
            {"$group": {
                "_id": "$officer_id",
                "total_requests": {"$sum": 1},
                "total_chars": {"$sum": "$char_count"},
                "estimated_cost_usd": {"$sum": "$estimated_cost_usd"}
            }},
            {"$sort": {"total_requests": -1}},
            {"$limit": limit}
        ]
        
        results = await db.translation_usage.aggregate(pipeline).to_list(limit)
        
        return [
            {
                "officer_id": r["_id"],
                "total_requests": r["total_requests"],
                "total_chars": r["total_chars"],
                "estimated_cost_usd": round(r["estimated_cost_usd"], 2)
            }
            for r in results
        ]
        
    except Exception as e:
        logger.error(f"Failed to get top users: {e}")
        return []
