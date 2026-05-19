from app.utils.date_validation import is_valid_date
from datetime import datetime
import re

# Only allow simple identifiers: letters, digits, underscores, no leading digit
_SAFE_COLUMN_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
_SQL_KEYWORDS = frozenset({
    "select", "insert", "update", "delete", "drop", "create", "alter",
    "from", "where", "join", "union", "into", "table", "index",
    "grant", "revoke", "truncate", "execute", "call",
})

def _validate_col(name: str) -> str:
    if not _SAFE_COLUMN_RE.match(name):
        raise ValueError(f"Invalid column name: {name!r}")
    if name.lower() in _SQL_KEYWORDS:
        raise ValueError(f"Column name is a reserved SQL keyword: {name!r}")
    return name

def build_sql_querys(base_query, filters_dict, date_column = "date", mode="WHERE", order_by=None, sort_dir="DESC", group_by=None): # mainly for get queries
    filters = [] # stores the SQL Filters
    params = [] # stores the variables
    mode = mode.upper()

    start_date = filters_dict.get("start_date")
    end_date = filters_dict.get("end_date")
    limit = filters_dict.get("limit")
    offset = filters_dict.get("offset")

    for key, value in filters_dict.items():
        if value is None or key in ["start_date", "end_date", "limit", "offset"]:
            continue

        col = _validate_col(key)

        # special cases
        if mode == "WHERE":
            if col in ["title", "description"]:
                filters.append(f"{col} ILIKE %s")
                params.append(f"%{value}%")
            else:
                filters.append(f"{col} = %s")
                params.append(value)
        elif mode == "SET":
            filters.append(f"{col} = %s")
            params.append(value)
        elif mode == "INSERT":
            filters.append(col)
            params.append(value)
            
    if mode == "WHERE":
        if start_date and end_date:
            if not is_valid_date(start_date, fmt="%m-%d-%Y") or not is_valid_date(end_date, fmt="%m-%d-%Y"):
                raise ValueError("Invalid date format. Use MM-DD-YYYY.")
            start = datetime.strptime(start_date, "%m-%d-%Y").date()
            end = datetime.strptime(end_date, "%m-%d-%Y").date()
            filters.append(f"{date_column} BETWEEN %s AND %s")
            params.extend([start, end])

        elif start_date:
            if not is_valid_date(start_date, fmt="%m-%d-%Y"):
                raise ValueError("Invalid start date format. Use MM-DD-YYYY.")
            start = datetime.strptime(start_date, "%m-%d-%Y").date()
            filters.append(f"{date_column} >= %s")
            params.append(start)

        elif end_date:
            if not is_valid_date(end_date, fmt="%m-%d-%Y"):
                raise ValueError("Invalid end date format. Use MM-DD-YYYY.")
            end = datetime.strptime(end_date, "%m-%d-%Y").date()
            filters.append(f"{date_column} <= %s")
            params.append(end)

    query = base_query

    if filters:
        if mode == "WHERE": # WHERE 
            query += " WHERE " + ' AND '.join(filters)
        elif mode == "SET": # patch 
            query += " SET " + ', '.join(filters)
        elif mode == "INSERT": # 
            placeholders = ["%s"] * len(filters)
            query += f" ({', '.join(filters)}) VALUES ({', '.join(placeholders)})"


    if mode == "WHERE":
        
        if group_by:
            if isinstance(group_by, list):
                group_clause = ", ".join(_validate_col(c) for c in group_by)
            else:
                group_clause = _validate_col(group_by)
            query += f" GROUP BY {group_clause}"

        if order_by is not None:
            sort_dir = sort_dir.upper()
            if sort_dir not in ["ASC", "DESC"]:
                sort_dir = "DESC"
            query += f" ORDER BY {_validate_col(order_by)} {sort_dir}"

        if limit is not None:
            try:
                limit = int(limit)
                if limit < 0:
                    raise ValueError("Limit must be a non-negative integer.")
                query += " LIMIT %s"
                params.append(limit)
            except ValueError:
                raise ValueError("Limit must be a non-negative integer.")

        if offset is not None:
            try:
                offset = int(offset)
                if offset < 0:
                    raise ValueError("Offset must be a non-negative integer.")
                query += " OFFSET %s"
                params.append(offset)
            except ValueError:
                raise ValueError("Offset must be a non-negative integer.")

    return query, params
