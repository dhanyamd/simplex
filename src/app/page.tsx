'use client';

import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import remarkGfm from 'remark-gfm'; 
import { Message, SearchResult, ChatSection,SuggestionType, TavilyImage,TavilyResponse } from '@/types/interface';

export default function SimplexPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult[]>([]);
  const [showTavilyModal, setShowTavilyModal] = useState(false);
  const [showReasoningModal, setShowReasoningModal] = useState(false);
  const [selectedMessageData, setSelectedMessageData] = useState<{tavily?: TavilyResponse, reasoning?: string}>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [chatSections, setChatSections] = useState<ChatSection[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  
  const suggestions: SuggestionType[] = [
    { label: "Blog Post Ideas", prefix: "Generate blog post ideas about: " },
  { label: "Social Media Post Captions", prefix: "Write engaging social media captions for: " },
  { label: "Email Subject Lines", prefix: "Create compelling email subject lines for: " },
  { label: "Presentation Outline", prefix: "Develop a presentation outline about: " },
  ];

  const handleSuggestionClick = (suggestion: SuggestionType) => {
    setSelectedSuggestion(suggestion.label);
    if (input) {
      setInput(suggestion.prefix + input);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setHasSubmitted(true)
    setLastQuery(input)
    setError(null)
    setCurrentSearchResults([])
    if(abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const userMessage = { role: 'user' as const, content: input}
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setCurrentReasoning('')

    //creating new chat section with loading states
    
  }
}