import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export const AuriChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Initialize position to bottom-right
  useEffect(() => {
    const savedPosition = localStorage.getItem("auriChatPosition");
    if (savedPosition) {
      const parsed = JSON.parse(savedPosition);
      setPosition(parsed);
    } else {
      setPosition({ 
        x: window.innerWidth - 80, 
        y: window.innerHeight - 100 
      });
    }
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (position.x !== 0 || position.y !== 0) {
      localStorage.setItem("auriChatPosition", JSON.stringify(position));
    }
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragStart.y));
      
      if (Math.abs(e.clientX - dragStart.x - position.x) > 5 || 
          Math.abs(e.clientY - dragStart.y - position.y) > 5) {
        setHasMoved(true);
      }
      
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      const touch = e.touches[0];
      const newX = Math.max(0, Math.min(window.innerWidth - 56, touch.clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 56, touch.clientY - dragStart.y));
      
      if (Math.abs(touch.clientX - dragStart.x - position.x) > 5 || 
          Math.abs(touch.clientY - dragStart.y - position.y) > 5) {
        setHasMoved(true);
      }
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, dragStart, position]);

  const handleClick = () => {
    if (!hasMoved) {
      navigate("/auri");
    }
  };

  // Don't show on /auri page
  if (location.pathname === "/auri") {
    return null;
  }

  return (
    <Button
      ref={buttonRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`fixed z-50 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 transition-all ${
        isDragging ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-110"
      }`}
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
      }}
      size="icon"
    >
      <Sparkles className="h-6 w-6 text-white" />
    </Button>
  );
};
