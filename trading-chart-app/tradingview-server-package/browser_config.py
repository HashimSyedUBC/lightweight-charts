import random
from typing import Dict, List, Any
import pytz
from datetime import datetime
from dataclasses import dataclass

@dataclass
class ProxyLocation:
    state: str
    country: str = 'US'

class BrowserFingerprint:
    """Generate random browser fingerprints"""
    
    # Common screen resolutions
    RESOLUTIONS = [
        (1920, 1080), (1366, 768), (1536, 864),
        (1440, 900), (1280, 720), (1600, 900)
    ]
    
    # Recent Chrome versions
    CHROME_VERSIONS = [
        "120.0.0.0", "119.0.0.0", "118.0.0.0",
        "117.0.0.0", "116.0.0.0", "115.0.0.0"
    ]
    
    # Operating systems and their user agents
    OS_CONFIGS = [
        {
            "os": "Windows",
            "versions": ["10.0", "11.0"],
            "platform": "Win64; x64",
        },
        {
            "os": "Macintosh",
            "versions": ["10_15_7", "11_0_0", "12_0_0", "13_0_0"],
            "platform": "Intel Mac OS X",
        }
    ]
    
    # Timezone mappings
    TIMEZONE_MAP = {
        'ny': 'America/New_York',
        'nj': 'America/New_York',
        'ca': 'America/Los_Angeles',
        'wa': 'America/Los_Angeles',
        'tx': 'America/Chicago',
        'fl': 'America/New_York',
        'il': 'America/Chicago',
        'az': 'America/Phoenix',
        'ga': 'America/New_York'
    }
    
    # Locale mappings
    LOCALE_MAP = {
        'ca': 'en-CA',
        'fl': 'en-US',
        'tx': 'en-US',
        'ny': 'en-US',
        'nj': 'en-US',
        'wa': 'en-US',
        'il': 'en-US',
        'az': 'en-US',
        'ga': 'en-US'
    }
    
    @classmethod
    def _get_geographic_viewport(cls, location: ProxyLocation) -> Dict[str, int]:
        """Get common viewport sizes for specific regions"""
        # East coast tends to have smaller screens on average
        east_coast = {'ny', 'nj', 'fl', 'ga'}
        if location.state.lower() in east_coast:
            return random.choice([
                {'width': 1366, 'height': 768},
                {'width': 1440, 'height': 900},
                {'width': 1280, 'height': 720}
            ])
        # West coast tends to have larger screens
        west_coast = {'ca', 'wa'}
        if location.state.lower() in west_coast:
            return random.choice([
                {'width': 1920, 'height': 1080},
                {'width': 1536, 'height': 864},
                {'width': 1600, 'height': 900}
            ])
        # Default mixed sizes
        return random.choice([
            {'width': size[0], 'height': size[1]} 
            for size in cls.RESOLUTIONS
        ])

    @classmethod
    def generate(cls, proxy_location: ProxyLocation) -> Dict[str, Any]:
        """Generate a random browser fingerprint matching proxy location"""
        # Get timezone for location
        timezone = cls.TIMEZONE_MAP.get(proxy_location.state.lower(), 'America/Chicago')
        
        # Get locale for location
        locale = cls.LOCALE_MAP.get(proxy_location.state.lower(), 'en-US')
        
        # Generate timezone-offset
        now = datetime.now(pytz.timezone(timezone))
        timezone_offset = now.strftime('%z')
        
        # Pick random OS config
        os_config = random.choice(cls.OS_CONFIGS)
        os_version = random.choice(os_config["versions"])
        chrome_version = random.choice(cls.CHROME_VERSIONS)
        
        # Generate user agent
        if os_config["os"] == "Windows":
            user_agent = f"Mozilla/5.0 ({os_config['os']} NT {os_version}; {os_config['platform']}) "
        else:
            user_agent = f"Mozilla/5.0 ({os_config['os']}; {os_config['platform']} {os_version}) "
        
        user_agent += f"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome_version} Safari/537.36"
        
        # Get viewport for location
        viewport = cls._get_geographic_viewport(proxy_location)
        
        # Generate random Accept-Language header
        languages = ["en-US", "en-GB", "en-CA", "en"]
        random.shuffle(languages)
        accept_language = ",".join(f"{lang};q={1.0-i*0.1:.1f}" for i, lang in enumerate(languages))
        
        return {
            "user_agent": user_agent,
            "viewport": viewport,
            "headers": {
                "accept-language": accept_language,
                "sec-ch-ua-timezone": timezone,
                "cookie": f"timezone_offset={timezone_offset};"
            },
            "timezone_id": timezone,
            "evaluateOnNewDocument": [
                # Override navigator properties
                '''() => {
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );
                    
                    Object.defineProperties(navigator, {
                        webdriver: {get: () => undefined},
                        languages: {get: () => [%LANGUAGES%]},
                        plugins: {get: () => [
                            {
                                "0": {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                                "description": "Portable Document Format",
                                "filename": "internal-pdf-viewer",
                                "name": "Chrome PDF Plugin",
                                "length": 1
                            },
                            {
                                "0": {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
                                "description": "Portable Document Format",
                                "filename": "internal-pdf-viewer",
                                "name": "Chrome PDF Viewer",
                                "length": 1
                            },
                            {
                                "0": {type: "application/x-nacl", suffixes: "", description: "Native Client Executable"},
                                "description": "Native Client Executable",
                                "filename": "internal-nacl-plugin",
                                "name": "Native Client",
                                "length": 1
                            }
                        ]},
                        vendor: {get: () => "Google Inc."},
                        platform: {get: () => %PLATFORM%},
                    });
                }''',
                # Add random WebGL noise
                '''() => {
                    const getParameter = WebGLRenderingContext.prototype.getParameter;
                    WebGLRenderingContext.prototype.getParameter = function(parameter) {
                        // Add some randomization to the WebGL fingerprint
                        if (parameter === 37445) {
                            return 'Intel Open Source Technology Center';
                        }
                        if (parameter === 37446) {
                            return 'Mesa DRI Intel(R) HD Graphics (SKL GT2)';
                        }
                        return getParameter.apply(this, arguments);
                    };
                }''',
                # Randomize canvas fingerprint
                '''() => {
                    const originalGetContext = HTMLCanvasElement.prototype.getContext;
                    HTMLCanvasElement.prototype.getContext = function(type, attributes) {
                        const context = originalGetContext.apply(this, arguments);
                        if (context && type === '2d') {
                            const originalFillText = context.fillText;
                            context.fillText = function() {
                                context.shadowColor = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},${Math.random()})`;
                                context.shadowBlur = Math.random() * 3;
                                context.shadowOffsetX = Math.random() * 2;
                                context.shadowOffsetY = Math.random() * 2;
                                return originalFillText.apply(this, arguments);
                            };
                        }
                        return context;
                    };
                }'''
            ]
        }
