from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.category import Category
from app.schemas.schemas import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(cat: CategoryCreate, db: Session = Depends(get_db)):
    db_cat = Category(
        name=cat.name,
        type=cat.type,
        parent_id=cat.parent_id,
        color=cat.color,
        is_system=False
    )
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete default system category")
    db.delete(cat)
    db.commit()
    return {"message": "Category deleted successfully"}
