from datetime import datetime

def is_valid_date(date_str, fmt="%m-%d-%Y"):
    try:
        datetime.strptime(date_str, fmt)
        return True
    except ValueError:
        return False
def validate_date_range(start_date, end_date):
    if not start_date or not end_date:
        return False, "Start date and end date are required."
    
    if not is_valid_date(start_date) or not is_valid_date(end_date):
        return False, "Invalid date format. Use MM-DD-YYYY."
    
    start = datetime.strptime(start_date, "%m-%d-%Y").date()
    end = datetime.strptime(end_date, "%m-%d-%Y").date()

    if start > end:
        return False, "Start date cannot be after end date."
    
    return True, ""