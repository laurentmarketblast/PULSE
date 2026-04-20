"""
WebSocket Manager for Real-Time Messaging
"""

import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set
from fastapi import WebSocket
import logging

logger = logging.getLogger("pulse.websocket")


class ConnectionManager:
    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # proposal_id -> set of user_ids currently typing
        self.typing_users: Dict[str, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept WebSocket connection and track user"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            
            # Clean up empty connection sets
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                logger.info(f"User {user_id} disconnected (no active connections)")
    
    def is_online(self, user_id: str) -> bool:
        """Check if user has any active connections"""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to all connections of a specific user"""
        if user_id not in self.active_connections:
            return
        
        disconnected = set()
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                disconnected.add(connection)
        
        # Clean up failed connections
        for conn in disconnected:
            self.active_connections[user_id].discard(conn)
    
    async def broadcast_to_proposal(self, proposal_id: str, sender_id: str, receiver_id: str, message: dict):
        """Send message to both users in a proposal"""
        await self.send_to_user(sender_id, message)
        await self.send_to_user(receiver_id, message)
    
    async def set_typing(self, proposal_id: str, user_id: str, is_typing: bool):
        """Update typing status for a user in a proposal"""
        if proposal_id not in self.typing_users:
            self.typing_users[proposal_id] = set()
        
        if is_typing:
            self.typing_users[proposal_id].add(user_id)
        else:
            self.typing_users[proposal_id].discard(user_id)
    
    def get_typing_users(self, proposal_id: str) -> Set[str]:
        """Get set of user IDs currently typing in a proposal"""
        return self.typing_users.get(proposal_id, set())


# Global connection manager instance
manager = ConnectionManager()
