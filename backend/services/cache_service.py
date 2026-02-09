"""Simple in-memory cache with TTL for frequently accessed data."""
import time
import asyncio
import logging
from typing import Any, Optional, Callable
from functools import wraps

logger = logging.getLogger(__name__)

class SimpleCache:
    """Thread-safe in-memory cache with TTL"""
    
    def __init__(self):
        self._cache = {}
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        async with self._lock:
            if key in self._cache:
                value, expiry = self._cache[key]
                if time.time() < expiry:
                    return value
                else:
                    del self._cache[key]
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300):
        """Set value with TTL in seconds (default 5 minutes)"""
        async with self._lock:
            self._cache[key] = (value, time.time() + ttl)
    
    async def delete(self, key: str):
        """Delete a key from cache"""
        async with self._lock:
            self._cache.pop(key, None)
    
    async def clear(self):
        """Clear all cache"""
        async with self._lock:
            self._cache.clear()
    
    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern (simple startswith match)"""
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(pattern)]
            for key in keys_to_delete:
                del self._cache[key]
    
    def stats(self) -> dict:
        """Get cache statistics"""
        now = time.time()
        valid = sum(1 for _, (_, exp) in self._cache.items() if exp > now)
        return {
            "total_keys": len(self._cache),
            "valid_keys": valid,
            "expired_keys": len(self._cache) - valid
        }


# Global cache instance
cache = SimpleCache()


def cached(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator for caching async function results.
    
    Usage:
        @cached(ttl=600, key_prefix="prices")
        async def get_prices():
            return await db.prices.find().to_list(100)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = f"{key_prefix}:{func.__name__}"
            if args:
                cache_key += f":{str(args)}"
            if kwargs:
                cache_key += f":{str(sorted(kwargs.items()))}"
            
            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl)
            logger.debug(f"Cache miss, stored: {cache_key}")
            
            return result
        return wrapper
    return decorator


async def invalidate_prices_cache():
    """Invalidate all price-related caches"""
    await cache.clear_pattern("prices:")
    await cache.clear_pattern("public_prices:")
    logger.info("Invalidated prices cache")


async def invalidate_all_cache():
    """Clear entire cache"""
    await cache.clear()
    logger.info("Cleared all cache")
