const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

export const cacheMiddleware = (key, duration = CACHE_DURATION) => {
  return (req, res, next) => {
    const cacheKey = key + JSON.stringify(req.query);
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < duration) {
      return res.json(cached.data);
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      if (data.success) {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
};

export const clearCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};