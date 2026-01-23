"""
WebSocket manager for real-time progress updates
"""

import json
import asyncio
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from models import WebSocketMessage, ProgressMessage


class WebSocketManager:
    """Manages WebSocket connections and broadcasts"""

    def __init__(self):
        # client_id -> set of websocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # batch_id -> set of client_ids subscribed
        self.batch_subscriptions: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = set()
        self.active_connections[client_id].add(websocket)

    def disconnect(self, websocket: WebSocket, client_id: str):
        """Remove a WebSocket connection"""
        if client_id in self.active_connections:
            self.active_connections[client_id].discard(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]

        # Clean up subscriptions
        for batch_id in list(self.batch_subscriptions.keys()):
            self.batch_subscriptions[batch_id].discard(client_id)
            if not self.batch_subscriptions[batch_id]:
                del self.batch_subscriptions[batch_id]

    def subscribe_to_batch(self, client_id: str, batch_id: str):
        """Subscribe a client to a batch's updates"""
        if batch_id not in self.batch_subscriptions:
            self.batch_subscriptions[batch_id] = set()
        self.batch_subscriptions[batch_id].add(client_id)

    def unsubscribe_from_batch(self, client_id: str, batch_id: str):
        """Unsubscribe a client from a batch's updates"""
        if batch_id in self.batch_subscriptions:
            self.batch_subscriptions[batch_id].discard(client_id)

    async def send_personal(self, message: WebSocketMessage, client_id: str):
        """Send a message to a specific client"""
        if client_id in self.active_connections:
            data = message.model_dump_json()
            disconnected = set()
            for websocket in self.active_connections[client_id]:
                try:
                    await websocket.send_text(data)
                except Exception:
                    disconnected.add(websocket)

            # Clean up disconnected
            for ws in disconnected:
                self.active_connections[client_id].discard(ws)

    async def broadcast_progress(self, progress: ProgressMessage):
        """Broadcast progress to all clients subscribed to the batch"""
        batch_id = progress.batch_id
        if batch_id not in self.batch_subscriptions:
            return

        message = WebSocketMessage(type="progress", data=progress.model_dump())
        data = message.model_dump_json()

        for client_id in self.batch_subscriptions[batch_id]:
            if client_id in self.active_connections:
                disconnected = set()
                for websocket in self.active_connections[client_id]:
                    try:
                        await websocket.send_text(data)
                    except Exception:
                        disconnected.add(websocket)

                # Clean up disconnected
                for ws in disconnected:
                    self.active_connections[client_id].discard(ws)

    async def broadcast_to_batch(self, batch_id: str, message: WebSocketMessage):
        """Broadcast a custom message to all clients subscribed to the batch"""
        if batch_id not in self.batch_subscriptions:
            return

        data = message.model_dump_json()

        for client_id in self.batch_subscriptions[batch_id]:
            if client_id in self.active_connections:
                disconnected = set()
                for websocket in self.active_connections[client_id]:
                    try:
                        await websocket.send_text(data)
                    except Exception:
                        disconnected.add(websocket)

                # Clean up disconnected
                for ws in disconnected:
                    self.active_connections[client_id].discard(ws)

    async def broadcast_to_all(self, message: WebSocketMessage):
        """Broadcast a message to all connected clients"""
        data = message.model_dump_json()

        for client_id, connections in self.active_connections.items():
            disconnected = set()
            for websocket in connections:
                try:
                    await websocket.send_text(data)
                except Exception:
                    disconnected.add(websocket)

            # Clean up disconnected
            for ws in disconnected:
                connections.discard(ws)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()


async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint handler"""
    await websocket_manager.connect(websocket, client_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message.get("type") == "subscribe":
                batch_id = message.get("batch_id")
                if batch_id:
                    websocket_manager.subscribe_to_batch(client_id, batch_id)
                    await websocket.send_text(json.dumps({
                        "type": "subscribed",
                        "batch_id": batch_id
                    }))

            elif message.get("type") == "unsubscribe":
                batch_id = message.get("batch_id")
                if batch_id:
                    websocket_manager.unsubscribe_from_batch(client_id, batch_id)

            elif message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, client_id)
    except Exception:
        websocket_manager.disconnect(websocket, client_id)
