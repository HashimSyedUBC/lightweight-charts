import React, { useState, useEffect } from 'react';
import { Time } from 'lightweight-charts';
import { ChartDataRange } from './TradingChart';
import { RectangleData } from './RectanglePrimitive';

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
  onAddRectangle: (rectangleData: RectangleData) => void;
  onRemoveRectangle: (id: string) => void;
  rectangles: RectangleData[];
  theme: 'dark' | 'light';
  dataRange: ChartDataRange | null;
}

export const DrawingControls: React.FC<DrawingControlsProps> = ({
  onAddTrendLine,
  onRemoveTrendLine,
  trendLines,
  onAddRectangle,
  onRemoveRectangle,
  rectangles,
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
  
  // Rectangle state - 4 points
  const [rectP1Time, setRectP1Time] = useState('20:00');
  const [rectP1Day, setRectP1Day] = useState('8');
  const [rectP1Price, setRectP1Price] = useState('149.00');
  
  const [rectP2Time, setRectP2Time] = useState('21:00');
  const [rectP2Day, setRectP2Day] = useState('8');
  const [rectP2Price, setRectP2Price] = useState('151.00');
  
  const [rectP3Time, setRectP3Time] = useState('21:00');
  const [rectP3Day, setRectP3Day] = useState('9');
  const [rectP3Price, setRectP3Price] = useState('152.00');
  
  const [rectP4Time, setRectP4Time] = useState('20:00');
  const [rectP4Day, setRectP4Day] = useState('9');
  const [rectP4Price, setRectP4Price] = useState('150.00');
  
  const [rectColor, setRectColor] = useState('#3b82f6');
  const [rectOpacity, setRectOpacity] = useState(0.3);
  const [rectBorderColor, setRectBorderColor] = useState('#2563eb');
  const [rectBorderWidth, setRectBorderWidth] = useState(2);
  
  // Label state - simplified with presets
  const [labelText, setLabelText] = useState('ENTRY');
  const [labelDay, setLabelDay] = useState('9');
  const [labelTime, setLabelTime] = useState('12:00');
  const [labelPrice, setLabelPrice] = useState('150.00');
  // Preset styling - not user configurable
  const labelColor = '#ef4444';
  const labelFontSize = 16;
  const labelBgColor = '#ffffff';
  
  // Initialize dropdown times based on data range
  useEffect(() => {
    if (dataRange) {
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
    
     // Fixed year and month for this data
    let year = 2025;
    let month = 7; // August (0-indexed)
    
    // Create UTC timestamp (this will display as the exact time on chart)
    const timestamp = Date.UTC(year, month, day, hours, minutes, 0) / 1000;
    
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

  const handleAddRectangle = () => {
    setErrors([]);
    
    // Validate all 4 price inputs
    const p1 = parseFloat(rectP1Price);
    const p2 = parseFloat(rectP2Price);
    const p3 = parseFloat(rectP3Price);
    const p4 = parseFloat(rectP4Price);
    
    if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4)) {
      setErrors(['Invalid price format. All prices must be numbers']);
      return;
    }
    
    if (!/^#[0-9A-F]{6}$/i.test(rectColor)) {
      setErrors(['Invalid fill color format. Must be hex (e.g., #FF0000)']);
      return;
    }
    
    if (!/^#[0-9A-F]{6}$/i.test(rectBorderColor)) {
      setErrors(['Invalid border color format. Must be hex (e.g., #FF0000)']);
      return;
    }
    
    // Convert all 4 time inputs to timestamps
    const time1 = convertTimeToTimestamp(rectP1Time, rectP1Day);
    const time2 = convertTimeToTimestamp(rectP2Time, rectP2Day);
    const time3 = convertTimeToTimestamp(rectP3Time, rectP3Day);
    const time4 = convertTimeToTimestamp(rectP4Time, rectP4Day);
    
    if (!time1 || !time2 || !time3 || !time4) {
      return; // Error already set in conversion function
    }
    
    
    // NOTE: NO CLAMPING for rectangle prices as requested
    const rectangleData: RectangleData = {
      id: Date.now().toString(),
      points: {
        p1: { time: time1, price: p1 },
        p2: { time: time2, price: p2 },
        p3: { time: time3, price: p3 },
        p4: { time: time4, price: p4 }
      },
      fillColor: rectColor,
      fillOpacity: rectOpacity,
      borderColor: rectBorderColor,
      borderWidth: rectBorderWidth
    };
    
    onAddRectangle(rectangleData);
    
    // Reset to default values
    setRectP1Price('149.00');
    setRectP2Price('151.00');
    setRectP3Price('152.00');
    setRectP4Price('150.00');
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
    } else {
      // Fallback if no data range
      setPoint1Time('09:30');
      setPoint2Time('16:00');
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

      {/* Rectangle Section */}
      <div style={{ marginTop: '30px', borderTop: `1px solid ${borderColor}`, paddingTop: '30px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Add Rectangle</h3>
        
        <div style={{ display: 'grid', gap: '15px' }}>
          {/* Point 1 */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Point 1 (Top-Left)</label>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={rectP1Day}
                  onChange={(e) => setRectP1Day(e.target.value)}
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
                  value={rectP1Time}
                  onChange={(e) => setRectP1Time(e.target.value)}
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
                value={rectP1Price}
                onChange={(e) => setRectP1Price(e.target.value)}
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
            <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Point 2 (Top-Right)</label>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={rectP2Day}
                  onChange={(e) => setRectP2Day(e.target.value)}
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
                  value={rectP2Time}
                  onChange={(e) => setRectP2Time(e.target.value)}
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
                value={rectP2Price}
                onChange={(e) => setRectP2Price(e.target.value)}
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

          {/* Point 3 */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Point 3 (Bottom-Right)</label>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={rectP3Day}
                  onChange={(e) => setRectP3Day(e.target.value)}
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
                  value={rectP3Time}
                  onChange={(e) => setRectP3Time(e.target.value)}
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
                value={rectP3Price}
                onChange={(e) => setRectP3Price(e.target.value)}
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

          {/* Point 4 */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Point 4 (Bottom-Left)</label>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={rectP4Day}
                  onChange={(e) => setRectP4Day(e.target.value)}
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
                  value={rectP4Time}
                  onChange={(e) => setRectP4Time(e.target.value)}
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
                value={rectP4Price}
                onChange={(e) => setRectP4Price(e.target.value)}
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

          {/* Style Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Fill Color</label>
              <input
                type="text"
                placeholder="#3b82f6"
                value={rectColor}
                onChange={(e) => setRectColor(e.target.value)}
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
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Fill Opacity</label>
              <input
                type="number"
                value={rectOpacity}
                onChange={(e) => setRectOpacity(parseFloat(e.target.value))}
                min="0"
                max="1"
                step="0.1"
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
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Border Color</label>
              <input
                type="text"
                placeholder="#2563eb"
                value={rectBorderColor}
                onChange={(e) => setRectBorderColor(e.target.value)}
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
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Border Width</label>
              <select
                value={rectBorderWidth}
                onChange={(e) => setRectBorderWidth(parseInt(e.target.value))}
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
          </div>

          {/* Add Rectangle Button */}
          <button
            onClick={handleAddRectangle}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3861fb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Add Rectangle
          </button>
        </div>

        {/* Existing Rectangles */}
        {rectangles.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Active Rectangles</h4>
            <div style={{ display: 'grid', gap: '10px' }}>
              {rectangles.map((rect) => (
                <div
                  key={rect.id}
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
                        height: '20px',
                        backgroundColor: rect.fillColor,
                        opacity: rect.fillOpacity,
                        border: `${rect.borderWidth}px solid ${rect.borderColor}`,
                        borderRadius: '2px'
                      }}
                    />
                    <span>
                      Rectangle {rect.id.slice(-6)}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveRectangle(rect.id)}
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
    </div>
  );
};
