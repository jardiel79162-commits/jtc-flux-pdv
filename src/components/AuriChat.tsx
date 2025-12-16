import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const AuriChat = () => {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate("/auri")}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 transition-all hover:scale-110"
      size="icon"
    >
      <Sparkles className="h-6 w-6 text-white" />
    </Button>
  );
};
