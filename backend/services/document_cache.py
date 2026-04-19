"""
Document Cache Service
======================
Local MongoDB caching layer for processed petitions and complaint letters.
Reduces API costs and latency by caching:
- Translated text
- Extracted entities
- BNS section suggestions

Cache key is generated from a hash of the original text.
"""
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
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


def generate_cache_key(text: str, operation: str = "translation") -> str:
    """Generate a unique cache key from text content."""
    # Normalize text (lowercase, strip whitespace)
    normalized = text.lower().strip()
    # Create hash
    text_hash = hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]
    return f"{operation}_{text_hash}"


async def get_cached_result(text: str, operation: str = "translation") -> Optional[Dict[str, Any]]:
    """
    Get cached result for the given text and operation.
    
    Args:
        text: Original text content
        operation: Type of operation (translation, entity_extraction, bns_suggestion)
    
    Returns:
        Cached result if found, None otherwise
    """
    try:
        db = get_db()
        cache_key = generate_cache_key(text, operation)
        
        result = await db.document_cache.find_one(
            {"cache_key": cache_key},
            {"_id": 0}
        )
        
        if result:
            # Update hit count
            await db.document_cache.update_one(
                {"cache_key": cache_key},
                {
                    "$inc": {"hit_count": 1},
                    "$set": {"last_accessed": datetime.now(timezone.utc).isoformat()}
                }
            )
            logger.info(f"Cache HIT for {operation}: {cache_key}")
            return result.get("cached_data")
        
        logger.info(f"Cache MISS for {operation}: {cache_key}")
        return None
        
    except Exception as e:
        logger.error(f"Cache lookup error: {e}")
        return None


async def set_cached_result(
    text: str,
    operation: str,
    result_data: Dict[str, Any],
    source_language: str = "unknown",
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Store result in cache.
    
    Args:
        text: Original text content
        operation: Type of operation
        result_data: Data to cache
        source_language: Detected source language
        metadata: Additional metadata
    
    Returns:
        True if cached successfully
    """
    try:
        db = get_db()
        cache_key = generate_cache_key(text, operation)
        
        cache_entry = {
            "cache_key": cache_key,
            "operation": operation,
            "text_length": len(text),
            "text_preview": text[:200] + "..." if len(text) > 200 else text,
            "source_language": source_language,
            "cached_data": result_data,
            "metadata": metadata or {},
            "hit_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_accessed": datetime.now(timezone.utc).isoformat()
        }
        
        await db.document_cache.update_one(
            {"cache_key": cache_key},
            {"$set": cache_entry},
            upsert=True
        )
        
        logger.info(f"Cached {operation} result: {cache_key}")
        return True
        
    except Exception as e:
        logger.error(f"Cache write error: {e}")
        return False


async def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    try:
        db = get_db()
        
        # Total entries
        total_entries = await db.document_cache.count_documents({})
        
        # By operation type
        pipeline = [
            {"$group": {
                "_id": "$operation",
                "count": {"$sum": 1},
                "total_hits": {"$sum": "$hit_count"}
            }}
        ]
        by_operation = await db.document_cache.aggregate(pipeline).to_list(100)
        
        # Calculate estimated savings (assuming $0.001 per API call)
        total_hits = sum(op.get("total_hits", 0) for op in by_operation)
        estimated_savings = total_hits * 0.001
        
        return {
            "total_entries": total_entries,
            "by_operation": {op["_id"]: {"count": op["count"], "hits": op["total_hits"]} for op in by_operation},
            "total_cache_hits": total_hits,
            "estimated_cost_savings_usd": round(estimated_savings, 2)
        }
        
    except Exception as e:
        logger.error(f"Cache stats error: {e}")
        return {"error": str(e)}


async def clear_old_cache(days_old: int = 30) -> int:
    """Clear cache entries older than specified days."""
    try:
        db = get_db()
        from datetime import timedelta
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
        cutoff_str = cutoff.isoformat()
        
        result = await db.document_cache.delete_many({
            "last_accessed": {"$lt": cutoff_str}
        })
        
        logger.info(f"Cleared {result.deleted_count} old cache entries")
        return result.deleted_count
        
    except Exception as e:
        logger.error(f"Cache cleanup error: {e}")
        return 0
