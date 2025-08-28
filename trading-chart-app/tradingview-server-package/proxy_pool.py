from dataclasses import dataclass
from typing import Dict, Optional, List
import random

class ProxyLocation:
    """Represents a proxy location with city and state"""
    def __init__(self, state: str, city: str = None):
        self.state = state.lower()
        self.city = city.lower() if city else None
        
    def __str__(self) -> str:
        if self.city:
            return f"us-{self.state}-{self.city}"
        return f"us-{self.state}"

class ProxyPool:
    """Manages a pool of proxy locations"""
    
    # Major tech hubs and population centers
    LOCATIONS = [
        # West Coast
        ProxyLocation("ca", "losangeles"),
        ProxyLocation("ca", "sanfrancisco"),
        ProxyLocation("ca", "sandiego"),
        ProxyLocation("wa", "seattle"),
        ProxyLocation("or", "portland"),
        
        # East Coast
        ProxyLocation("ny", "newyork"),
        ProxyLocation("ma", "boston"),
        ProxyLocation("dc", "washington"),
        ProxyLocation("fl", "miami"),
        ProxyLocation("ga", "atlanta"),
        
        # Central
        ProxyLocation("il", "chicago"),
        ProxyLocation("tx", "austin"),
        ProxyLocation("tx", "dallas"),
        ProxyLocation("co", "denver"),
        ProxyLocation("nv", "lasvegas"),
        
        # Other Major Cities
        ProxyLocation("az", "phoenix"),
        ProxyLocation("pa", "philadelphia"),
        ProxyLocation("tx", "houston"),
        ProxyLocation("oh", "columbus"),
        ProxyLocation("mi", "detroit")
    ]
    
    def __init__(self):
        self.current_index = 0
        self.used_locations = set()
    
    def get_next_location(self) -> ProxyLocation:
        """Get next location using round-robin"""
        location = self.LOCATIONS[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.LOCATIONS)
        return location
    
    def get_random_location(self) -> ProxyLocation:
        """Get a random location that hasn't been used recently"""
        available = [loc for loc in self.LOCATIONS if str(loc) not in self.used_locations]
        if not available:
            self.used_locations.clear()
            available = self.LOCATIONS
        
        location = random.choice(available)
        self.used_locations.add(str(location))
        return location

@dataclass
class OxyLabsProxy:
    username: str
    password: str
    _proxy_pool: ProxyPool = None
    
    def __post_init__(self):
        """Initialize proxy pool after instance creation"""
        self._proxy_pool = ProxyPool()
    
    def _get_full_username(self, location: ProxyLocation = None) -> str:
        """Get username with location"""
        if not location:
            location = self._proxy_pool.get_random_location()
        return f"customer-{self.username}-residential-{location}"
    
    def get_url(self, location: ProxyLocation = None) -> str:
        """Get residential proxy URL with optional specific location"""
        auth = f"{self._get_full_username(location)}:{self.password}"
        return f"http://{auth}@pr.oxylabs.io:7777"
    
    def get_auth(self, location: ProxyLocation = None) -> Dict[str, str]:
        """Get proxy authentication headers"""
        return {
            "proxy-authorization": f"Basic {self._get_full_username(location)}:{self.password}"
        }
    
    def get_next_proxy(self) -> Dict[str, str]:
        """Get next residential proxy configuration using round-robin"""
        location = self._proxy_pool.get_next_location()
        return {
            'url': self.get_url(location),
            'username': self._get_full_username(location),
            'password': self.password,
            'location': str(location),
            'type': 'residential'
        }
    
    def get_random_proxy(self) -> Dict[str, str]:
        """Get random residential proxy configuration"""
        location = self._proxy_pool.get_random_location()
        return {
            'url': self.get_url(location),
            'username': self._get_full_username(location),
            'password': self.password,
            'location': str(location),
            'type': 'residential'
        }
