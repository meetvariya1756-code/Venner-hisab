import re
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.rule import CategorizationRule
from app.models.party import Party
from app.models.category import Category

class CategorizationService:
    @staticmethod
    def auto_categorize(narration: str, db: Session) -> Tuple[Optional[int], Optional[int], str]:
        """
        Matches transaction narration against rules ordered by priority.
        Returns: (party_id, category_id, review_status)
        """
        if not narration:
            return None, None, "uncategorized"

        narr_upper = narration.upper()

        # Fetch active rules ordered by priority ascending
        rules = db.query(CategorizationRule).filter(CategorizationRule.is_active == True).order_by(CategorizationRule.priority.asc()).all()

        for rule in rules:
            match = False
            pattern = rule.pattern.strip()
            
            if rule.match_type == "KEYWORD":
                if pattern.upper() in narr_upper:
                    match = True
            elif rule.match_type == "REGEX":
                try:
                    if re.search(pattern, narration, re.IGNORECASE):
                        match = True
                except re.error:
                    pass
            elif rule.match_type == "EXACT":
                if pattern.upper() == narr_upper:
                    match = True

            if match:
                return rule.party_id, rule.category_id, "auto_matched"

        # Fallback: Check Parties directly by name/aliases
        parties = db.query(Party).all()
        for party in parties:
            if party.name.upper() in narr_upper:
                return party.id, party.category_id, "auto_matched"

        return None, None, "uncategorized"
