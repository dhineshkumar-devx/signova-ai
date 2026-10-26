import React, { useState } from 'react';
import { HelpCircle, Search } from 'lucide-react';

export const ISL_GUIDE_DATA = [
  {
    name: 'GOOD',
    category: 'Common',
    gesture: 'Thumbs Up',
    description: 'Extend thumb vertically upwards with rest of fingers curled into a fist.',
    color: '#10b981',
  },
  {
    name: 'WELCOME',
    category: 'Greetings',
    gesture: 'Open Palm Inward Sweep',
    description: 'Extend open palm with fingers together, moving hand inward toward body.',
    color: '#10b981',
  },
  {
    name: 'PEACE',
    category: 'Common',
    gesture: 'V-Sign (Victory)',
    description: 'Extend Index and Middle fingers in a V-shape, curling thumb, ring, and pinky.',
    color: '#f59e0b',
  },
  {
    name: 'HELLO',
    category: 'Greetings',
    gesture: 'Open Hand Wave',
    description: 'Extend open palm upright and wave gently left-to-right near face height.',
    color: '#3b82f6',
  },
  {
    name: 'THANK_YOU',
    category: 'Polite',
    gesture: 'Chin Touch Forward',
    description: 'Touch fingers of open palm to chin and move hand gently forward.',
    color: '#06b6d4',
  },
  {
    name: 'YES',
    category: 'Common',
    gesture: 'Fist Nod',
    description: 'Make a loose fist and tilt hand gently forward at wrist.',
    color: '#8b5cf6',
  },
  {
    name: 'NO',
    category: 'Common',
    gesture: 'Finger Snap / Tap',
    description: 'Extend Index and Middle fingers and tap tips against Thumb.',
    color: '#ef4444',
  },
  {
    name: 'HELP',
    category: 'Emergency',
    gesture: 'Fist on Open Palm',
    description: 'Place a closed fist onto the open palm of non-dominant hand.',
    color: '#f97316',
  },
  {
    name: 'STOP',
    category: 'Control',
    gesture: 'Flat Raised Open Palm',
    description: 'Raise flat open palm facing directly toward the camera.',
    color: '#dc2626',
  },
  {
    name: 'PLEASE',
    category: 'Polite',
    gesture: 'Chest Circular Rub',
    description: 'Place flat open palm on chest and move in a gentle clockwise circle.',
    color: '#6366f1',
  },
  {
    name: 'SORRY',
    category: 'Polite',
    gesture: 'Closed Fist Chest Rub',
    description: 'Make a closed fist and rub over center of chest in circular motion.',
    color: '#a855f7',
  },
  {
    name: 'LOVE',
    category: 'Emotions',
    gesture: 'I-Love-You Sign',
    description: 'Extend Thumb, Index, and Pinky fingers outward while holding Middle and Ring down.',
    color: '#ec4899',
  },
  {
    name: 'OK',
    category: 'Approval',
    gesture: 'O-Circle Finger Sign',
    description: 'Touch tip of Thumb and Index to form an "O" circle, with remaining 3 fingers extended.',
    color: '#14b8a6',
  },

  // 10 Additional Verified ISL Signs
  {
    name: 'FAMILY',
    category: 'Social',
    gesture: 'F-Circle Hands Joined',
    description: 'Form "O" circles with both hands and bring thumbs together in a full circle.',
    color: '#3b82f6',
  },
  {
    name: 'FRIEND',
    category: 'Social',
    gesture: 'Interlocked Index Fingers',
    description: 'Hook index finger of right hand into hooked index finger of left hand.',
    color: '#10b981',
  },
  {
    name: 'TEACHER',
    category: 'Education',
    gesture: 'Temple-to-Forward Sign',
    description: 'Touch fingertips near temples and move both hands forward in teaching gesture.',
    color: '#8b5cf6',
  },
  {
    name: 'STUDENT',
    category: 'Education',
    gesture: 'Knowledge to Forehead',
    description: 'Take flat open hand from non-dominant palm and touch fingertips to forehead.',
    color: '#06b6d4',
  },
  {
    name: 'HOME',
    category: 'Places',
    gesture: 'A-Frame Roof Shape',
    description: 'Touch fingertips of both open hands together at an angle to form a roof.',
    color: '#f59e0b',
  },
  {
    name: 'WATER',
    category: 'Essentials',
    gesture: 'W-Hand Shape at Lips',
    description: 'Extend Index, Middle, and Ring fingers (W-shape) and tap index against chin/lips.',
    color: '#0284c7',
  },
  {
    name: 'FOOD',
    category: 'Essentials',
    gesture: 'Gasping Fingertips at Mouth',
    description: 'Gather all 5 fingertips together and tap tips against lips twice.',
    color: '#eab308',
  },
  {
    name: 'HAPPY',
    category: 'Emotions',
    gesture: 'Chest Upward Patting',
    description: 'Pat flat open palms gently upward over chest in cheerful motion.',
    color: '#10b981',
  },
  {
    name: 'SAD',
    category: 'Emotions',
    gesture: 'Face Downward Wipe',
    description: 'Place open palm in front of face and move slowly downward while tilting head.',
    color: '#64748b',
  },
  {
    name: 'VICTORY',
    category: 'Common',
    gesture: 'Dual V-Signs Raised High',
    description: 'Raise V-sign gestures high in the air celebrating victory.',
    color: '#f59e0b',
  },
];

export const ISLGuide: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredSigns = ISL_GUIDE_DATA.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.gesture.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={20} color="#2563eb" />
          <span>23 Verified ISL Hand Gesture Reference Guide</span>
        </div>

        {/* Live Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search 23 ISL signs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
        Perform any of these 23 Indian Sign Language gestures in front of your camera for real-time recognition, 3D tracking, and audio voice synthesis:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
        {filteredSigns.map((item, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: item.color }}>
                  {item.name.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  {item.category}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                👋 {item.gesture}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

