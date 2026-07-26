import re
import json
from typing import Optional
from sqlalchemy.orm import Session
from app.models.party import Party
from app.models.transaction import Transaction
from app.models.rule import CategorizationRule

class PartyService:
    @staticmethod
    def extract_counterparty_name(narration: str) -> Optional[str]:
        if not narration:
            return None
        
        # 1. Check NEFT patterns (e.g. "NEFT AXISCN1237890859 MEESHO TECHNOLOGIES PRIVATE")
        neft_match = re.search(r'NEFT\s+[A-Z0-9]+\s+(.+?)(?:NEFTINW|$)', narration, re.IGNORECASE)
        if neft_match:
            name = neft_match.group(1).strip()
            if len(name) > 3:
                return name

        # 2. Check UPI patterns (e.g. "UPI/Mr SANGITA KUS/603416065210/UPI")
        upi_match = re.search(r'UPI/([^/]+)/', narration, re.IGNORECASE)
        if upi_match:
            name = upi_match.group(1).strip()
            if len(name) > 2:
                return name

        # 3. Check IMPS patterns
        imps_match = re.search(r'IMPS-\d+(.+?)(?:/IMPS|$)', narration, re.IGNORECASE)
        if imps_match:
            name = imps_match.group(1).strip()
            if len(name) > 2:
                return name

        return None

    @staticmethod
    def merge_parties(source_party_ids: list[int], target_party_id: int, db: Session) -> Party:
        target_party = db.query(Party).filter(Party.id == target_party_id).first()
        if not target_party:
            raise ValueError("Target party not found.")

        # Reassign transactions
        db.query(Transaction).filter(Transaction.party_id.in_(source_party_ids)).update(
            {"party_id": target_party_id}, synchronize_session=False
        )

        # Reassign rules
        db.query(CategorizationRule).filter(CategorizationRule.party_id.in_(source_party_ids)).update(
            {"party_id": target_party_id}, synchronize_session=False
        )

        # Merge aliases
        existing_aliases = json.loads(target_party.aliases or "[]")
        source_parties = db.query(Party).filter(Party.id.in_(source_party_ids)).all()
        for sp in source_parties:
            if sp.name not in existing_aliases:
                existing_aliases.append(sp.name)
            sp_aliases = json.loads(sp.aliases or "[]")
            for a in sp_aliases:
                if a not in existing_aliases:
                    existing_aliases.append(a)

        target_party.aliases = json.dumps(existing_aliases)

        # Delete source parties
        for sp in source_parties:
            db.delete(sp)

        db.commit()
        db.refresh(target_party)
        return target_party
