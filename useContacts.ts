import { useState, useEffect } from 'react';

export interface Contact {
  id: string;
  name: string;
  lastUsed: number;
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('onlyus-contacts');
    if (saved) {
      try {
        setContacts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse contacts', e);
      }
    }
  }, []);

  const saveContact = (id: string, name: string) => {
    setContacts(prev => {
      const existing = prev.find(c => c.id === id);
      const updated = existing 
        ? prev.map(c => c.id === id ? { ...c, name, lastUsed: Date.now() } : c)
        : [...prev, { id, name, lastUsed: Date.now() }];
      
      const sorted = updated.sort((a, b) => b.lastUsed - a.lastUsed);
      localStorage.setItem('onlyus-contacts', JSON.stringify(sorted));
      return sorted;
    });
  };

  const removeContact = (id: string) => {
    setContacts(prev => {
      const updated = prev.filter(c => c.id !== id);
      localStorage.setItem('onlyus-contacts', JSON.stringify(updated));
      return updated;
    });
  };

  return { contacts, saveContact, removeContact };
}
