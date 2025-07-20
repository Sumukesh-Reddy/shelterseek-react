import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Message() {
    const navigate = useNavigate();
    const location = useLocation();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [recipient, setRecipient] = useState(null);

    useEffect(() => {
        // Get host data from navigation state
        if (location.state) {
            setRecipient({
                id: location.state.hostId,
                name: location.state.hostName,
                email: location.state.hostEmail
            });
        }

        const storedMessages = JSON.parse(localStorage.getItem("messages")) || [];
        setMessages(storedMessages);
    }, [location.state]);

    const handleBack = () => {
        navigate(-1); // Go back to previous page
    };

    const handleSendMessage = () => {
        if (!newMessage.trim() || !recipient) return;
        
        const message = {
            hostId: recipient.id,
            hostName: recipient.name,
            hostEmail: recipient.email,
            message: newMessage,
            timestamp: new Date().toLocaleString()
        };

        const updatedMessages = [...messages, message];
        setMessages(updatedMessages);
        localStorage.setItem("messages", JSON.stringify(updatedMessages));
        setNewMessage('');
    };

    return (
        <div style={{
            fontFamily: 'Arial, sans-serif',
            margin: '20px'
        }}>
            <button 
                id="homeBtn"
                onClick={handleBack}
                style={{
                    height: '40px',
                    width: 'auto',
                    padding: '0 20px',
                    backgroundColor: '#d72d6e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease, transform 0.2s ease',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
            >
                Back
            </button>
            <div style={{
                maxWidth: '800px',
                margin: '0 auto',
                padding: '20px',
                border: '1px solid #ccc',
                borderRadius: '5px'
            }}>
                <h1 style={{ color: '#d72d6e' }}>
                    {recipient ? `Message to ${recipient.name}` : 'New Message'}
                </h1>
                
                {recipient && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message here..."
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #ddd'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleSendMessage}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#d72d6e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            Send Message
                        </button>
                    </div>
                )}

                <h2>Message History</h2>
                <div id="messages-list">
                    {messages.length === 0 ? (
                        <p>No messages found.</p>
                    ) : (
                        messages
                            .filter(msg => recipient ? msg.hostId === recipient.id : true)
                            .map((message, index) => (
                                <div key={index} style={{
                                    marginBottom: '20px',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    backgroundColor: '#f9f9f9'
                                }}>
                                    <h3 style={{ margin: '0', color: '#d72d6e' }}>To: {message.hostName}</h3>
                                    <p style={{ margin: '5px 0' }}>{message.message}</p>
                                    <p style={{ fontSize: '0.9em', color: '#777' }}>Sent on: {message.timestamp}</p>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default Message;