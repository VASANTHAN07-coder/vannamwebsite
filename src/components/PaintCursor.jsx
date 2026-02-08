import React, { useEffect, useRef } from 'react';

/**
 * PaintCursor Component
 * Renders a custom animated paint brush cursor that follows the mouse
 */
const PaintCursor = ({ isActive, brushSize = 20, position = { x: 0, y: 0 } }) => {
    const cursorRef = useRef(null);

    useEffect(() => {
        if (!isActive || !cursorRef.current) return;

        const moveCursor = (e) => {
            if (cursorRef.current) {
                cursorRef.current.style.left = (e.clientX - brushSize / 2) + 'px';
                cursorRef.current.style.top = (e.clientY - brushSize / 2) + 'px';
            }
        };

        document.addEventListener('mousemove', moveCursor);
        return () => document.removeEventListener('mousemove', moveCursor);
    }, [isActive, brushSize]);

    if (!isActive) return null;

    return (
        <div
            ref={cursorRef}
            style={{
                position: 'fixed',
                width: brushSize,
                height: brushSize,
                pointerEvents: 'none',
                zIndex: 9999,
                left: position.x,
                top: position.y,
            }}
        >
            {/* Paint Brush Circle */}
            <svg
                width={brushSize}
                height={brushSize}
                viewBox={`0 0 ${brushSize} ${brushSize}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
            >
                {/* Outer circle - brush area */}
                <circle
                    cx={brushSize / 2}
                    cy={brushSize / 2}
                    r={brushSize / 2 - 1}
                    fill="none"
                    stroke="#FF6B6B"
                    strokeWidth="2"
                    opacity="0.9"
                />

                {/* Inner circle - center point */}
                <circle
                    cx={brushSize / 2}
                    cy={brushSize / 2}
                    r="2.5"
                    fill="#FF6B6B"
                    opacity="0.8"
                />

                {/* Paint brush bristles effect */}
                <line
                    x1={brushSize / 2}
                    y1={brushSize / 2 - brushSize / 3}
                    x2={brushSize / 2}
                    y2={brushSize / 2 - 2}
                    stroke="#FF6B6B"
                    strokeWidth="1"
                    opacity="0.6"
                />
                <line
                    x1={brushSize / 2}
                    y1={brushSize / 2 + brushSize / 3}
                    x2={brushSize / 2}
                    y2={brushSize / 2 + 2}
                    stroke="#FF6B6B"
                    strokeWidth="1"
                    opacity="0.6"
                />
                <line
                    x1={brushSize / 2 - brushSize / 3}
                    y1={brushSize / 2}
                    x2={brushSize / 2 - 2}
                    y2={brushSize / 2}
                    stroke="#FF6B6B"
                    strokeWidth="1"
                    opacity="0.6"
                />
                <line
                    x1={brushSize / 2 + brushSize / 3}
                    y1={brushSize / 2}
                    x2={brushSize / 2 + 2}
                    y2={brushSize / 2}
                    stroke="#FF6B6B"
                    strokeWidth="1"
                    opacity="0.6"
                />

                {/* Paint droplet effect */}
                <path
                    d={`M ${brushSize / 2} ${brushSize / 2 + 5} Q ${brushSize / 2 - 1.5} ${brushSize / 2 + 7} ${brushSize / 2} ${brushSize / 2 + 9} Q ${brushSize / 2 + 1.5} ${brushSize / 2 + 7} ${brushSize / 2} ${brushSize / 2 + 5}`}
                    fill="#FF6B6B"
                    opacity="0.7"
                />
            </svg>
        </div>
    );
};

export default PaintCursor;
