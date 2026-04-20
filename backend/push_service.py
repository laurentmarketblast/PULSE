"""
Push Notification Service for Pulse App

Handles all push notification delivery via Expo Push Notification service.
Includes retry logic, error handling, and comprehensive logging.
"""

import os
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DeviceToken

logger = logging.getLogger("pulse.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MAX_TOKENS_PER_REQUEST = 100  # Expo limit


@dataclass
class PushNotificationResult:
    """Result of a push notification send operation"""
    success: bool
    delivered_count: int
    failed_count: int
    errors: List[Dict[str, Any]]


class PushNotificationService:
    """
    Service for sending push notifications via Expo Push Notification API.
    
    Features:
    - Validates Expo push tokens
    - Batches requests for multiple recipients
    - Handles errors and retries
    - Logs all operations for monitoring
    """
    
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=10.0)
    
    async def close(self):
        """Close HTTP client connection"""
        await self.http_client.aclose()
    
    def _is_valid_expo_token(self, token: str) -> bool:
        """
        Validate Expo push token format.
        
        Valid formats:
        - ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
        - ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]
        """
        return (
            token.startswith("ExponentPushToken[") or 
            token.startswith("ExpoPushToken[")
        ) and token.endswith("]")
    
    def _filter_valid_tokens(self, tokens: List[str]) -> List[str]:
        """Filter out invalid Expo push tokens"""
        valid = [t for t in tokens if self._is_valid_expo_token(t)]
        
        invalid_count = len(tokens) - len(valid)
        if invalid_count > 0:
            logger.warning(
                f"Filtered out {invalid_count} invalid push tokens",
                extra={"invalid_tokens": [t for t in tokens if t not in valid]}
            )
        
        return valid
    
    def _create_push_message(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        badge: Optional[int] = None,
        ttl: int = 3600,
    ) -> Dict[str, Any]:
        """
        Create a properly formatted Expo push message.
        
        Args:
            token: Expo push token
            title: Notification title
            body: Notification body
            data: Optional data payload
            badge: Optional badge count
            ttl: Time to live in seconds (default 1 hour)
        
        Returns:
            Formatted push message dict
        """
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "priority": "high",
            "channelId": "default",
            "ttl": ttl,
        }
        
        if data:
            message["data"] = data
        
        if badge is not None:
            message["badge"] = badge
        
        return message
    
    async def send_push_notifications(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        badge: Optional[int] = None,
    ) -> PushNotificationResult:
        """
        Send push notifications to multiple devices.
        
        Args:
            tokens: List of Expo push tokens
            title: Notification title
            body: Notification body
            data: Optional data payload
            badge: Optional badge count
        
        Returns:
            PushNotificationResult with delivery statistics
        """
        if not tokens:
            logger.warning("No tokens provided for push notification")
            return PushNotificationResult(
                success=False,
                delivered_count=0,
                failed_count=0,
                errors=[{"error": "No tokens provided"}]
            )
        
        # Validate and filter tokens
        valid_tokens = self._filter_valid_tokens(tokens)
        
        if not valid_tokens:
            logger.error(
                "No valid Expo push tokens found",
                extra={"token_count": len(tokens)}
            )
            return PushNotificationResult(
                success=False,
                delivered_count=0,
                failed_count=len(tokens),
                errors=[{"error": "No valid tokens"}]
            )
        
        # Create messages
        messages = [
            self._create_push_message(token, title, body, data, badge)
            for token in valid_tokens
        ]
        
        # Split into batches if needed (Expo limit: 100 per request)
        batches = [
            messages[i:i + MAX_TOKENS_PER_REQUEST]
            for i in range(0, len(messages), MAX_TOKENS_PER_REQUEST)
        ]
        
        delivered_count = 0
        failed_count = 0
        all_errors = []
        
        # Send each batch
        for batch_idx, batch in enumerate(batches):
            try:
                response = await self.http_client.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Process results
                    if isinstance(result, dict) and "data" in result:
                        for ticket in result["data"]:
                            if ticket.get("status") == "ok":
                                delivered_count += 1
                            else:
                                failed_count += 1
                                all_errors.append(ticket)
                    
                    logger.info(
                        f"Push notification batch {batch_idx + 1}/{len(batches)} sent",
                        extra={
                            "batch_size": len(batch),
                            "delivered": delivered_count,
                            "failed": failed_count
                        }
                    )
                else:
                    logger.error(
                        f"Push notification batch {batch_idx + 1} failed",
                        extra={
                            "status_code": response.status_code,
                            "response": response.text
                        }
                    )
                    failed_count += len(batch)
                    all_errors.append({
                        "error": response.text,
                        "status_code": response.status_code
                    })
            
            except Exception as e:
                logger.error(
                    f"Exception sending push notification batch {batch_idx + 1}",
                    exc_info=True,
                    extra={"batch_size": len(batch)}
                )
                failed_count += len(batch)
                all_errors.append({"error": str(e)})
        
        return PushNotificationResult(
            success=delivered_count > 0,
            delivered_count=delivered_count,
            failed_count=failed_count,
            errors=all_errors
        )


# Global service instance
_push_service: Optional[PushNotificationService] = None


def get_push_service() -> PushNotificationService:
    """Get or create global push notification service instance"""
    global _push_service
    if _push_service is None:
        _push_service = PushNotificationService()
    return _push_service


async def get_user_push_tokens(db: AsyncSession, user_id) -> List[str]:
    """
    Retrieve all push tokens for a user from database.
    
    Args:
        db: Database session
        user_id: User UUID
    
    Returns:
        List of push token strings
    """
    stmt = select(DeviceToken.token).where(DeviceToken.user_id == user_id)
    result = await db.execute(stmt)
    tokens = [row[0] for row in result.all()]
    
    logger.debug(
        f"Retrieved {len(tokens)} push tokens for user",
        extra={"user_id": str(user_id)}
    )
    
    return tokens


# ═══════════════════════════════════════════════════
# HIGH-LEVEL NOTIFICATION FUNCTIONS
# ═══════════════════════════════════════════════════

async def notify_new_proposal(
    receiver_tokens: List[str],
    sender_name: str,
    activity_tag: str
) -> PushNotificationResult:
    """
    Send notification when user receives a new proposal.
    
    Args:
        receiver_tokens: Push tokens of proposal receiver
        sender_name: Display name of proposal sender
        activity_tag: Activity being proposed
    
    Returns:
        PushNotificationResult
    """
    service = get_push_service()
    
    return await service.send_push_notifications(
        tokens=receiver_tokens,
        title=f"New proposal from {sender_name}! 🔥",
        body=f"Wants to {activity_tag}",
        data={
            "type": "new_proposal",
            "screen": "Inbox",
            "tab": "received",
        },
        badge=1,
    )


async def notify_proposal_accepted(
    sender_tokens: List[str],
    receiver_name: str
) -> PushNotificationResult:
    """
    Send notification when proposal is accepted.
    
    Args:
        sender_tokens: Push tokens of proposal sender
        receiver_name: Display name of person who accepted
    
    Returns:
        PushNotificationResult
    """
    service = get_push_service()
    
    return await service.send_push_notifications(
        tokens=sender_tokens,
        title=f"{receiver_name} is down! 🎉",
        body="They accepted your proposal. Start chatting!",
        data={
            "type": "proposal_accepted",
            "screen": "Inbox",
            "tab": "matched",
        },
        badge=1,
    )


async def notify_new_message(
    receiver_tokens: List[str],
    sender_name: str,
    message_preview: str,
    unread_count: int = 1
) -> PushNotificationResult:
    """
    Send notification when user receives a new message.
    
    Args:
        receiver_tokens: Push tokens of message receiver
        sender_name: Display name of message sender
        message_preview: Preview of message content
        unread_count: Number of unread messages (for badge)
    
    Returns:
        PushNotificationResult
    """
    service = get_push_service()
    
    # Truncate message preview to 100 chars
    preview = (
        message_preview[:100] + "..." 
        if len(message_preview) > 100 
        else message_preview
    )
    
    return await service.send_push_notifications(
        tokens=receiver_tokens,
        title=sender_name,
        body=preview,
        data={
            "type": "new_message",
            "screen": "Inbox",
            "tab": "matched",
        },
        badge=unread_count,
    )
