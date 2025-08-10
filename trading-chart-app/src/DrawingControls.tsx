import React, { useState, useEffect } from 'react';
import { Time } from 'lightweight-charts';
import { ChartDataRange } from './TradingChart';

export interface TrendLineData {
  id: string;
  point1: {
    time: Time;
    price: number;
  };
  point2: {
    time: Time;
    price: number;
  };
  color: string;
  lineWidth?: number;
  lineStyle?: number; // 0 = solid, 1 = dotted, 2 = dashed
}

interface DrawingControlsProps {
  onAddTrendLine: (lineData: TrendLineData) => void;
  onRemoveTrendLine: (id: string) => void;
  trendLines: TrendLineData[];
  theme: 'dark' | 'light';
  dataRange: ChartDataRange | null;
}

export const DrawingControls: React.FC<DrawingControlsProps> = ({
  onAddTrendLine,
  onRemoveTrendLine,
  trendLines,
  theme,
  dataRange
}) => {
  // Time selection state - using text inputs
  const [point1Time, setPoint1Time] = useState('20:00');
  const [point1Day, setPoint1Day] = useState('8');
  const [point2Time, setPoint2Time] = useState('19:45');
  const [point2Day, setPoint2Day] = useState('9');
  const [timeError, setTimeError] = useState<string>('');
  
  const [point1Price, setPoint1Price] = useState('150.25');
  const [point2Price, setPoint2Price] = useState('152.75');
  
  // Initialize dropdown times based on data range
  useEffect(() => {
    if (dataRange) {
      console.log(' Data range received:', dataRange.minTime, 'to', dataRange.maxTime);
      console.log(' Chart displays:', `${new Date(dataRange.minTime * 1000).getUTCHours()}:00 to ${new Date(dataRange.maxTime * 1000).getUTCHours()}:${new Date(dataRange.maxTime * 1000).getUTCMinutes().toString().padStart(2, '0')} (EST)`);
      
      // Set initial times based on data range
      const startDate = new Date(dataRange.minTime * 1000);
      const endDate = new Date(dataRange.maxTime * 1000);
      
      // Format as HH:MM for display
      const startHours = startDate.getUTCHours().toString().padStart(2, '0');
      const startMinutes = startDate.getUTCMinutes().toString().padStart(2, '0');
      const endHours = endDate.getUTCHours().toString().padStart(2, '0');
      const endMinutes = endDate.getUTCMinutes().toString().padStart(2, '0');
      
      setPoint1Time(`${startHours}:${startMinutes}`);
      setPoint2Time(`${endHours}:${endMinutes}`);
      
      // Set reasonable price defaults based on data range
      const midPrice = (dataRange.minPrice + dataRange.maxPrice) / 2;
      const priceRange = dataRange.maxPrice - dataRange.minPrice;
      setPoint1Price((midPrice - priceRange * 0.1).toFixed(2));
      setPoint2Price((midPrice + priceRange * 0.1).toFixed(2));
    }
  }, [dataRange]);
  const [color, setColor] = useState('#9333ea'); // Purple color
  const [lineWidth, setLineWidth] = useState(3); // Thicker for visibility
  const [lineStyle, setLineStyle] = useState<0 | 1 | 2>(0);
  const [errors, setErrors] = useState<string[]>([]);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#d1d4dc' : '#000000';
  const borderColor = isDark ? '#333' : '#ddd';
  const inputBg = isDark ? '#2a2a2a' : '#f5f5f5';
  const errorColor = '#ff4444';
  const successColor = '#44ff44';

  // Validate time format HH:MM
  const validateTimeFormat = (timeStr: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
  };

  // Convert time string (HH:MM) to Unix timestamp with clamping
  const convertTimeToTimestamp = (timeStr: string, dayStr: string): Time | null => {
    if (!validateTimeFormat(timeStr)) {
      setTimeError('Invalid time format. Use HH:MM (24-hour)');
      return null;
    }
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const day = parseInt(dayStr);
    
    // Validate day
    if (isNaN(day) || (day !== 8 && day !== 9)) {
      setTimeError('Day must be 8 or 9');
      return null;
    }
    
    // Fixed year and month for this data
    let year = 2025;
    let month = 7; // August (0-indexed)
    
    // Create UTC timestamp (this will display as the exact time on chart)
    const timestamp = Date.UTC(year, month, day, hours, minutes, 0) / 1000;
    
    console.log(`Time conversion: ${timeStr} -> ${timestamp} (${new Date(timestamp * 1000).toUTCString()})`);
    
    // No clamping - chart will extend time scale as needed
    console.log(`✅ Time ${timestamp} will extend chart if needed`);
    
    setTimeError(''); // Clear any previous errors
    return timestamp as Time;
  };
  
  // Clamp price to visible range
  const clampPrice = (price: number): number => {
    if (!dataRange) return price;
    
    if (price < dataRange.minPrice) {
      return dataRange.minPrice;
    }
    if (price > dataRange.maxPrice) {
      return dataRange.maxPrice;
    }
    
    return price;
  };

  const handleAddLine = () => {
    setErrors([]);
    
    // Validate price inputs
    const p1 = parseFloat(point1Price);
    const p2 = parseFloat(point2Price);
    
    if (isNaN(p1) || isNaN(p2)) {
      setErrors(['Invalid price format. Must be a number']);
      return;
    }
    
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      setErrors(['Invalid color format. Must be hex (e.g., #FF0000)']);
      return;
    }
    
    // Convert time inputs to timestamps
    const timestamp1 = convertTimeToTimestamp(point1Time, point1Day);
    const timestamp2 = convertTimeToTimestamp(point2Time, point2Day);
    
    if (!timestamp1 || !timestamp2) {
      return; // Error already set in conversion function
    }
    
    // Clamp prices to valid range
    const clampedP1 = clampPrice(p1);
    const clampedP2 = clampPrice(p2);
    
    const lineData: TrendLineData = {
      id: Date.now().toString(),
      point1: {
        time: timestamp1,
        price: p1
      },
      point2: {
        time: timestamp2,
        price: p2
      },
      color,
      lineWidth,
      lineStyle
    };
    
    onAddTrendLine(lineData);
    
    // Reset to default values
    setCurrentTime();
    setPoint1Price('150.25');
    setPoint2Price('152.75');
    setErrors([]);
  };

  const setCurrentTime = () => {
    if (dataRange) {
      // Reset to data range times
      const startDate = new Date(dataRange.minTime * 1000);
      const endDate = new Date(dataRange.maxTime * 1000);
      
      const startHours = startDate.getUTCHours().toString().padStart(2, '0');
      const startMinutes = startDate.getUTCMinutes().toString().padStart(2, '0');
      const endHours = endDate.getUTCHours().toString().padStart(2, '0');
      const endMinutes = endDate.getUTCMinutes().toString().padStart(2, '0');
      
      setPoint1Time(`${startHours}:${startMinutes}`);
      setPoint2Time(`${endHours}:${endMinutes}`);
      
      console.log(`🔄 Reset times to data range: ${startHours}:${startMinutes} to ${endHours}:${endMinutes} (EST)`);
    } else {
      // Fallback if no data range
      setPoint1Time('09:30');
      setPoint2Time('16:00');
      console.log(`🔄 Reset times to default: 09:30 to 16:00 (EST)`);
    }
  };

  return (
    <div style={{
      backgroundColor: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '20px',
      marginTop: '20px',
      color: textColor
    }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Add Trend Line</h3>
      
      <div style={{ display: 'grid', gap: '15px' }}>
        {/* Point 1 */}
        <div>
          <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Point 1</label>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={point1Day}
                onChange={(e) => {
                  setPoint1Day(e.target.value);
                  setTimeError(''); // Clear error on change
                }}
                placeholder="Day"
                style={{
                  padding: '8px',
                  backgroundColor: inputBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '4px',
                  color: textColor,
                  fontSize: '14px',
                  width: '50px'
                }}
              />
              <input
                type="text"
                value={point1Time}
                onChange={(e) => {
                  setPoint1Time(e.target.value);
                  setTimeError(''); // Clear error on change
                }}
                placeholder="HH:MM"
                style={{
                  padding: '8px',
                  backgroundColor: inputBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '4px',
                  color: textColor,
                  fontSize: '14px',
                  width: '100px'
                }}
              />
              <span style={{ color: textColor, fontSize: '12px' }}>Aug (24hr EST)</span>
            </div>
            <input
              type="text"
              placeholder="Price"
              value={point1Price}
              onChange={(e) => setPoint1Price(e.target.value)}
              style={{
                padding: '8px',
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                color: textColor,
                fontSize: '14px',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Point 2 */}
        <div>
          <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Point 2</label>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={point2Day}
                onChange={(e) => {
                  setPoint2Day(e.target.value);
                  setTimeError(''); // Clear error on change
                }}
                placeholder="Day"
                style={{
                  padding: '8px',
                  backgroundColor: inputBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '4px',
                  color: textColor,
                  fontSize: '14px',
                  width: '50px'
                }}
              />
              <input
                type="text"
                value={point2Time}
                onChange={(e) => {
                  setPoint2Time(e.target.value);
                  setTimeError(''); // Clear error on change
                }}
                placeholder="HH:MM"
                style={{
                  padding: '8px',
                  backgroundColor: inputBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '4px',
                  color: textColor,
                  fontSize: '14px',
                  width: '100px'
                }}
              />
              <span style={{ color: textColor, fontSize: '12px' }}>Aug (24hr EST)</span>
            </div>
            <input
              type="text"
              placeholder="Price"
              value={point2Price}
              onChange={(e) => setPoint2Price(e.target.value)}
              style={{
                padding: '8px',
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                color: textColor,
                fontSize: '14px',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Time Error Display */}
        {timeError && (
          <div style={{ 
            color: errorColor, 
            fontSize: '12px',
            padding: '8px',
            backgroundColor: isDark ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 68, 68, 0.05)',
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            {timeError}
          </div>
        )}

        {/* Style Options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '500' }}>Color</label>
            <input
              type="text"
              placeholder="#3861fb"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                padding: '8px',
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                color: textColor,
                fontSize: '14px',
                marginTop: '5px'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '500' }}>Width</label>
            <select
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              style={{
                padding: '8px',
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                color: textColor,
                fontSize: '14px',
                marginTop: '5px',
                width: '100%'
              }}
            >
              <option value="1">1px</option>
              <option value="2">2px</option>
              <option value="3">3px</option>
              <option value="4">4px</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '500' }}>Style</label>
            <select
              value={lineStyle}
              onChange={(e) => setLineStyle(parseInt(e.target.value) as 0 | 1 | 2)}
              style={{
                padding: '8px',
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                color: textColor,
                fontSize: '14px',
                marginTop: '5px',
                width: '100%'
              }}
            >
              <option value="0">Solid</option>
              <option value="1">Dotted</option>
              <option value="2">Dashed</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {errors.length > 0 && (
          <div style={{ 
            color: errorColor, 
            fontSize: '14px',
            padding: '8px',
            backgroundColor: isDark ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 68, 68, 0.05)',
            borderRadius: '4px'
          }}>
            {errors.map((err, idx) => <div key={idx}>{err}</div>)}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAddLine}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3861fb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Add Trend Line
          </button>
          <button
            onClick={setCurrentTime}
            style={{
              padding: '10px 20px',
              backgroundColor: isDark ? '#333' : '#eee',
              color: textColor,
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
            title="Set to current time"
          >
            Now
          </button>
        </div>
      </div>

      {/* Existing Lines */}
      {trendLines.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Active Trend Lines</h4>
          <div style={{ display: 'grid', gap: '10px' }}>
            {trendLines.map((line) => (
              <div
                key={line.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '3px',
                      backgroundColor: line.color,
                      borderRadius: '2px'
                    }}
                  />
                  <span>
                    ${line.point1.price.toFixed(2)} → ${line.point2.price.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveTrendLine(line.id)}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: 'transparent',
                    color: errorColor,
                    border: `1px solid ${errorColor}`,
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
