import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface DocumentEditorProps {
  documentId: Id<"documents">;
  onBack: () => void;
}

export function DocumentEditor({ documentId, onBack }: DocumentEditorProps) {
  const document = useQuery(api.documents.getDocument, { documentId });
  const activeUsers = useQuery(api.documents.getActiveUsers, { documentId });
  const updateDocument = useMutation(api.documents.updateDocument);
  const updateUserPresence = useMutation(api.documents.updateUserPresence);
  
  const [content, setContent] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize content when document loads
  useEffect(() => {
    if (document && content !== document.content) {
      setContent(document.content);
    }
  }, [document]);

  // Auto-save functionality
  useEffect(() => {
    if (!document || content === document.content) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsTyping(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateDocument({
          documentId,
          content,
          cursorPosition,
        });
        setIsTyping(false);
      } catch (error) {
        toast.error("Failed to save changes");
        setIsTyping(false);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, cursorPosition, documentId, updateDocument, document]);

  // Update user presence
  useEffect(() => {
    if (presenceTimeoutRef.current) {
      clearTimeout(presenceTimeoutRef.current);
    }

    presenceTimeoutRef.current = setTimeout(() => {
      updateUserPresence({
        documentId,
        cursorPosition,
      });
    }, 500);

    return () => {
      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
      }
    };
  }, [cursorPosition, documentId, updateUserPresence]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleSelectionChange = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  if (!document) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getLanguageClass = (language?: string) => {
    if (!language) return "";
    return `language-${language}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Editor Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
            <div className="flex items-center gap-4 mt-1">
              <span className={`px-2 py-1 text-xs rounded-full ${
                document.type === "code" 
                  ? "bg-blue-100 text-blue-800" 
                  : "bg-green-100 text-green-800"
              }`}>
                {document.type === "code" ? `Code (${document.language})` : "Note"}
              </span>
              <span className="text-sm text-gray-500">
                {isTyping ? "Saving..." : "Saved"}
              </span>
            </div>
          </div>
          
          {/* Active Users */}
          {activeUsers && activeUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Active users:</span>
              <div className="flex -space-x-2">
                {activeUsers.map((user, index) => (
                  <div
                    key={user.userId}
                    className="w-8 h-8 rounded-full bg-primary text-white text-xs flex items-center justify-center border-2 border-white"
                    title={user.userName}
                    style={{
                      backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
                    }}
                  >
                    {user.userName.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onSelect={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onClick={handleSelectionChange}
          className={`w-full h-full p-6 resize-none border-none outline-none font-mono text-sm leading-relaxed ${
            document.type === "code" ? getLanguageClass(document.language) : ""
          }`}
          placeholder={
            document.type === "code" 
              ? "Start coding..." 
              : "Start writing your notes..."
          }
          spellCheck={document.type === "note"}
        />
        
        {/* Cursor indicators for other users */}
        {activeUsers?.map((user, index) => (
          <div
            key={user.userId}
            className="absolute pointer-events-none"
            style={{
              // This is a simplified cursor position - in a real app you'd need more sophisticated positioning
              top: `${Math.floor(user.cursorPosition / 80) * 1.5 + 1.5}rem`,
              left: `${(user.cursorPosition % 80) * 0.6 + 1.5}rem`,
            }}
          >
            <div
              className="w-0.5 h-5 animate-pulse"
              style={{
                backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
              }}
            />
            <div
              className="text-xs text-white px-1 py-0.5 rounded mt-1 whitespace-nowrap"
              style={{
                backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
              }}
            >
              {user.userName}
            </div>
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="bg-gray-50 border-t px-6 py-2 text-sm text-gray-600">
        <div className="flex justify-between items-center">
          <div>
            Lines: {content.split('\n').length} | 
            Characters: {content.length} | 
            Cursor: {cursorPosition}
          </div>
          <div>
            Last modified: {new Date(document.lastModifiedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
