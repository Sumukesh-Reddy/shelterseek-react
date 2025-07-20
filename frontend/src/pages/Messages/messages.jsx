import React, { useState, useEffect } from 'react';
import './messages.css';
function Messages() {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const storedMessages = JSON.parse(localStorage.getItem("messages")) || [];
        setMessages(storedMessages);
    }, []);

    const back = () => {
        window.location.href = "/";
    };

    return (
        <div className="message-container">
            <button id="homeBtn" onClick={back}>Back to Home</button>
            <h1>My Messages</h1>
            <div id="messages-list">
                {messages.length === 0 ? (
                    <p>No messages found.</p>
                ) : (
                    messages.map((message, index) => (
                        <div key={index} className="message">
                            <h3>To: {message.hostName}</h3>
                            <p>{message.message}</p>
                            <p className="timestamp">Sent on: {message.timestamp}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Messages;