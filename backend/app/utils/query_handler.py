from app.utils.date_validation import is_valid_date 
def build_sql_querys(base_query, filters_dict, date_column = "date", mode="WHERE"): # mainly for get queries
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

        # special cases 
        if mode == "WHERE":
            if key in ["title", "description"]:
                filters.append(f"{key} ILIKE %s")
                params.append(f"%{value}%")
            else:
                filters.append(f"{key} = %s")
                params.append(value)
        elif mode == "SET":
            filters.append(f"{key} = %s")
            params.append(value)
        elif mode == "INSERT":
            filters.append(key)
            params.append(value)
            
    if mode == "WHERE":
        if start_date and end_date:
            if not is_valid_date(start_date) or not is_valid_date(end_date):
                raise ValueError("Invalid date format. Use YYYY-MM-DD.")
            filters.append(f"{date_column} BETWEEN %s AND %s")
            params.extend([start_date, end_date])
        elif start_date:
            if not is_valid_date(start_date):
                raise ValueError("Invalid start date format. Use YYYY-MM-DD.")
            filters.append(f"{date_column} >= %s")
            params.append(start_date)
        elif end_date:
            if not is_valid_date(end_date):
                raise ValueError("Invalid end date format. Use YYYY-MM-DD.")
            filters.append(f"{date_column} <= %s")
            params.append(end_date)

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
        if limit is not None:
            if not isinstance(limit, int) or limit < 0:
                raise ValueError("Limit must be a non-negative integer.")
            query += " LIMIT %s"
            params.append(limit)

        if offset is not None:
            if not isinstance(offset, int) or offset < 0:
                raise ValueError("Offset must be a non-negative integer.")
            query += " OFFSET %s"
            params.append(offset)

    return query, params
