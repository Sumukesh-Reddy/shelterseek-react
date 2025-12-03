// client/src/components/HotelChatbot.jsx
import React, { useEffect, useRef, useState } from "react";

const api = {
  sendMessageToBot: async (message, history) => {
    const res = await fetch('http://localhost:4000/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(`AI server error: ${res.status} ${txt || ''}`);
    }
    return res.json();
  },
  bookRoom: async (hotelId, bookingDetails) => {
    const res = await fetch('http://localhost:4000/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId, bookingDetails }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(`Booking server error: ${res.status} ${txt || ''}`);
    }
    return res.json();
  },
};

function Message({ m }) {
  if (m.type === "bot" && m.hotels) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm bg-gray-100 p-3 rounded-lg max-w-prose">{m.text}</div>
        <div className="flex flex-col gap-3">
          {m.hotels.map((h) => (
            <div key={h.id} className="flex border rounded-lg p-3 items-center gap-4 max-w-xl">
              <div className="w-20 h-16 bg-gray-200 rounded-md flex items-center justify-center text-xs">Image</div>
              <div className="flex-1">
                <div className="font-semibold">{h.name}</div>
                <div className="text-sm text-gray-600">{h.location} · {h.rating}★</div>
                <div className="text-sm text-gray-700 mt-1">{h.description}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="font-semibold">${h.price}/night</div>
                <button data-hotelid={h.id} className="py-1 px-3 bg-blue-600 text-white rounded text-sm book-btn">Book</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-prose ${m.type === "user" ? "self-end bg-blue-600 text-white" : "bg-gray-100 text-gray-900"} p-3 rounded-lg`}>{m.text}</div>
  );
}

export default function HotelChatbot() {
  const [messages, setMessages] = useState([
    { id: 1, type: "bot", text: "Hi! I'm Helo — your hotel booking assistant. Where would you like to stay and when?", suggestions: ["Search hotels in Goa", "Show budget hotels"] },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [bookingModal, setBookingModal] = useState(null);
  const containerRef = useRef();

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    function onClick(e) {
      const btn = e.target.closest(".book-btn");
      if (btn) {
        const hotelId = btn.getAttribute("data-hotelid");
        const lastBot = [...messages].reverse().find((m) => m.type === "bot" && m.hotels);
        const hotel = lastBot?.hotels?.find((h) => h.id === hotelId);
        if (hotel) openBookingModal(hotel);
      }
    }
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  }, [messages]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  async function sendMessage(text) {
    if (!text?.trim()) return;
    const userMsg = { id: Date.now(), type: "user", text: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const res = await api.sendMessageToBot(text.trim(), messages.concat(userMsg));
      const botMsg = { id: Date.now() + 1, type: "bot", text: res.reply || "", suggestions: res.suggestions || [], hotels: res.hotels || null };
      setMessages((m) => [...m, botMsg]);
    } catch (err) {
      setMessages((m) => [...m, { id: Date.now(), type: "bot", text: "Sorry — an error occurred while contacting the assistant." }]);
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  }

  function onSuggestionClick(s) { sendMessage(s); }

  function openBookingModal(hotel) {
    setBookingModal({ hotel, details: { name: "Guest", nights: 1, guests: 2, checkin: "2025-12-01", checkout: "2025-12-02" } });
  }

  async function confirmBooking(details) {
    setBookingModal(null);
    setMessages((m) => [...m, { id: Date.now(), type: "user", text: `Book ${details.hotel.name} for ${details.details.guests} guests from ${details.details.checkin} to ${details.details.checkout}` }]);
    setIsTyping(true);
    try {
      const res = await api.bookRoom(details.hotel.id, details.details);
      if (res.success) {
        setMessages((m) => [...m, { id: Date.now()+2, type: "bot", text: `Booking confirmed! Your booking id is ${res.bookingId}.` }]);
      } else {
        setMessages((m) => [...m, { id: Date.now()+2, type: "bot", text: `Booking failed: ${res.error || 'unknown'}` }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { id: Date.now()+2, type: "bot", text: `Booking failed due to a network error.` }]);
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="bg-white border rounded-2xl shadow-lg overflow-hidden flex flex-col h-[600px]">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">H</div>
            <div>
              <div className="font-semibold">Helo — Hotel Booking Assistant</div>
              <div className="text-xs text-gray-500">Ask me to search hotels, check availability and book rooms.</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">Secure · Fast · 24/7</div>
        </div>

        <div ref={containerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-white to-gray-50">
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.type === "user" ? "justify-end" : "justify-start"}`}>
                <Message m={m} />
              </div>
            ))}

            {isTyping && (
              <div className="flex">
                <div className="bg-gray-100 p-2 rounded-lg inline-block">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t bg-white">
          <div className="flex gap-2 items-center">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(input); }} placeholder="Type something like 'Search hotels in Goa for 2 guests'" className="flex-1 border rounded-lg px-3 py-2 focus:outline-none" />
            <button onClick={() => sendMessage(input)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Send</button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto">
            {(messages.slice().reverse().find((m) => m.type === 'bot')?.suggestions || []).map((s, i) => (
              <button key={i} onClick={() => onSuggestionClick(s)} className="whitespace-nowrap px-3 py-1 border rounded-full text-sm bg-gray-100">{s}</button>
            ))}
          </div>
        </div>
      </div>

      {bookingModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-lg">Confirm Booking</div>
                <div className="text-sm text-gray-600">{bookingModal.hotel.name} · {bookingModal.hotel.location}</div>
              </div>
              <button className="text-gray-500" onClick={() => setBookingModal(null)}>✕</button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm text-gray-700">Guest name</label>
                <input className="w-full border rounded px-3 py-2 mt-1" defaultValue={bookingModal.details.name} id="guestname" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-700">Check-in</label>
                  <input type="date" defaultValue={bookingModal.details.checkin} className="w-full border rounded px-3 py-2 mt-1" id="checkin" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Check-out</label>
                  <input type="date" defaultValue={bookingModal.details.checkout} className="w-full border rounded px-3 py-2 mt-1" id="checkout" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-700">Guests</label>
                  <input type="number" defaultValue={bookingModal.details.guests} className="w-full border rounded px-3 py-2 mt-1" id="guests" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Nights</label>
                  <input type="number" defaultValue={bookingModal.details.nights} className="w-full border rounded px-3 py-2 mt-1" id="nights" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setBookingModal(null)} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={() => {
                const details = {
                  hotel: bookingModal.hotel,
                  details: {
                    name: document.getElementById('guestname').value,
                    checkin: document.getElementById('checkin').value,
                    checkout: document.getElementById('checkout').value,
                    guests: parseInt(document.getElementById('guests').value || '1', 10),
                    nights: parseInt(document.getElementById('nights').value || '1', 10),
                  }
                };
                confirmBooking(details);
              }} className="px-4 py-2 bg-blue-600 text-white rounded">Confirm Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
