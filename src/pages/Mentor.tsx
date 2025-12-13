import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Bot, User, Sparkles, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAIMentorLimits } from "@/hooks/useAIMentorUsage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-mentor`;

const Mentor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { questionsUsed, dailyLimit, questionsRemaining, hasReachedLimit, isPremium, isLoading: limitsLoading } = useAIMentorLimits();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Client-side checks for UX only - server validates everything
    if (!isPremium) {
      toast.error("O Mentor IA é exclusivo para assinantes Plus!");
      navigate("/upgrade");
      return;
    }

    if (hasReachedLimit) {
      toast.error("Você atingiu o limite diário de perguntas ao Mentor IA.");
      return;
    }

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    try {
      // Get fresh JWT token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      // Handle server-side errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Falha ao conectar com o Mentor IA";
        
        if (response.status === 401) {
          toast.error("Sessão expirada. Faça login novamente.");
          navigate("/auth");
          return;
        }
        if (response.status === 403) {
          toast.error(errorMessage);
          navigate("/upgrade");
          return;
        }
        if (response.status === 429) {
          toast.error(errorMessage);
          // Refresh usage data
          queryClient.invalidateQueries({ queryKey: ["ai-mentor-usage"] });
          return;
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Resposta vazia do servidor");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      // Refresh usage data after successful message
      queryClient.invalidateQueries({ queryKey: ["ai-mentor-usage"] });
    } catch (error) {
      console.error("Mentor error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar mensagem. Tente novamente.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">Mentor IA</h1>
                <p className="text-xs text-muted-foreground">Seu especialista em estudos</p>
              </div>
            </div>
          </div>
          
          {isPremium && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              {questionsRemaining}/{dailyLimit} perguntas
            </Badge>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 container mx-auto px-4 py-4 flex flex-col max-w-3xl">
        {!isPremium && !limitsLoading ? (
          <Card className="flex-1 flex items-center justify-center">
            <CardContent className="text-center py-12">
              <div className="p-4 rounded-full bg-primary/10 inline-flex mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Recurso Exclusivo Plus</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                O Mentor IA é exclusivo para assinantes Plus. Tenha acesso a um especialista em estudos com 6 perguntas por dia!
              </p>
              <Button onClick={() => navigate("/upgrade")} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Assinar Plus
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-primary/10 inline-flex mb-4">
                      <Bot className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Olá! Sou seu Mentor IA</h2>
                    <p className="text-muted-foreground max-w-md">
                      Estou aqui para ajudar você nos estudos. Pergunte sobre qualquer tema: matemática, português, história, física, química e muito mais!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="p-2 rounded-full bg-primary/10 h-fit">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                      {message.role === "user" && (
                        <div className="p-2 rounded-full bg-secondary h-fit">
                          <User className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-3 justify-start">
                      <div className="p-2 rounded-full bg-primary/10 h-fit">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-2xl px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="pt-4 border-t border-border mt-4">
              {hasReachedLimit ? (
                <Card className="bg-muted/50">
                  <CardContent className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Você usou todas as {dailyLimit} perguntas de hoje. Volte amanhã!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua dúvida..."
                    className="min-h-[60px] max-h-[120px] resize-none"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="h-[60px] w-[60px]"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Mentor;
