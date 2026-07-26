import pdfplumber
import pypdf
from typing import List, Dict, Any, Tuple

class PasswordProtectedPDFException(Exception):
    pass

def check_and_extract_pdf_pages(file_path: str, password: str = None) -> List[Dict[str, Any]]:
    # Step 1: Check password protection via pypdf
    try:
        reader = pypdf.PdfReader(file_path)
        if reader.is_encrypted:
            if password:
                decrypted = reader.decrypt(password)
                if not decrypted:
                    raise PasswordProtectedPDFException("Invalid password for PDF statement.")
            else:
                raise PasswordProtectedPDFException("PDF statement is password protected.")
    except Exception as e:
        if isinstance(e, PasswordProtectedPDFException):
            raise e
        # PyPDF error on encrypted PDF without password
        if "encrypted" in str(e).lower() or "password" in str(e).lower():
            raise PasswordProtectedPDFException("PDF statement is password protected.")

    pages_data = []
    try:
        with pdfplumber.open(file_path, password=password) as pdf:
            for index, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                text = page.extract_text() or ""
                pages_data.append({
                    "page_number": index + 1,
                    "tables": tables,
                    "text": text
                })
    except Exception as e:
        if "password" in str(e).lower() or "encrypted" in str(e).lower():
            raise PasswordProtectedPDFException("PDF statement is password protected.")
        raise e

    return pages_data
