"""Statistics routes for orders analytics."""
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from typing import Optional, List
from database import db
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/statistics", tags=["Statistics"])


@router.get("/{calculator_type}")
async def get_statistics(
    calculator_type: str,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    employee: Optional[str] = Query(None, description="Employee username filter")
):
    """Get statistics for orders with optional date range and employee filter."""
    
    # Determine collection based on calculator type
    if calculator_type == "sauna":
        collection = db.sauna_orders
        currency = "PLN"
    elif calculator_type == "balia":
        collection = db.orders
        currency = "€"
    else:
        return {"error": "Invalid calculator type"}
    
    # Build query filter
    query = {}
    
    # Date filter
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        if date_filter:
            query["orderDate"] = date_filter
    
    # Employee filter
    if employee and employee != "all":
        query["createdBy"] = employee
    
    # Fetch orders
    orders = await collection.find(query, {"_id": 0}).to_list(10000)
    
    if not orders:
        return {
            "totalOrders": 0,
            "totalRevenue": 0,
            "averageCheck": 0,
            "currency": currency,
            "topModels": [],
            "promotionStats": {"discount": 0, "gift": 0},
            "dailyStats": [],
            "employeeStats": [],
            "periodComparison": None,
            "orders": []
        }
    
    # Calculate basic stats
    total_orders = len(orders)
    total_revenue = sum(order.get("total", 0) for order in orders)
    average_check = total_revenue / total_orders if total_orders > 0 else 0
    
    # Top models
    model_counts = {}
    model_revenue = {}
    for order in orders:
        model_name = order.get("modelName", "Unknown")
        model_counts[model_name] = model_counts.get(model_name, 0) + 1
        model_revenue[model_name] = model_revenue.get(model_name, 0) + order.get("total", 0)
    
    top_models = [
        {
            "name": name,
            "count": count,
            "revenue": model_revenue.get(name, 0),
            "percentage": round(count / total_orders * 100, 1) if total_orders > 0 else 0
        }
        for name, count in sorted(model_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    # Promotion stats (discount vs gift)
    discount_count = sum(1 for order in orders if order.get("discountPercent", 0) > 0)
    gift_count = total_orders - discount_count
    
    promotion_stats = {
        "discount": discount_count,
        "gift": gift_count,
        "discountPercentage": round(discount_count / total_orders * 100, 1) if total_orders > 0 else 0,
        "giftPercentage": round(gift_count / total_orders * 100, 1) if total_orders > 0 else 0,
        "totalDiscountAmount": sum(
            (order.get("subtotal", order.get("total", 0)) - order.get("total", 0))
            for order in orders if order.get("discountPercent", 0) > 0
        )
    }
    
    # Daily stats
    daily_data = {}
    for order in orders:
        date = order.get("orderDate", "")[:10]  # Get YYYY-MM-DD part
        if date:
            if date not in daily_data:
                daily_data[date] = {"count": 0, "revenue": 0}
            daily_data[date]["count"] += 1
            daily_data[date]["revenue"] += order.get("total", 0)
    
    daily_stats = [
        {"date": date, "count": data["count"], "revenue": data["revenue"]}
        for date, data in sorted(daily_data.items())
    ]
    
    # Employee stats
    employee_data = {}
    for order in orders:
        emp = order.get("createdBy", "Unknown") or "Unknown"
        if emp not in employee_data:
            employee_data[emp] = {"count": 0, "revenue": 0}
        employee_data[emp]["count"] += 1
        employee_data[emp]["revenue"] += order.get("total", 0)
    
    employee_stats = [
        {
            "name": name,
            "count": data["count"],
            "revenue": data["revenue"],
            "averageCheck": round(data["revenue"] / data["count"], 2) if data["count"] > 0 else 0
        }
        for name, data in sorted(employee_data.items(), key=lambda x: x[1]["revenue"], reverse=True)
    ]
    
    # Period comparison (if date range provided)
    period_comparison = None
    if start_date and end_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            period_days = (end - start).days + 1
            
            # Previous period
            prev_start = (start - timedelta(days=period_days)).strftime("%Y-%m-%d")
            prev_end = (start - timedelta(days=1)).strftime("%Y-%m-%d")
            
            prev_query = {"orderDate": {"$gte": prev_start, "$lte": prev_end}}
            if employee and employee != "all":
                prev_query["createdBy"] = employee
            
            prev_orders = await collection.find(prev_query, {"_id": 0}).to_list(10000)
            
            prev_total_orders = len(prev_orders)
            prev_total_revenue = sum(order.get("total", 0) for order in prev_orders)
            
            # Calculate changes
            orders_change = (
                ((total_orders - prev_total_orders) / prev_total_orders * 100)
                if prev_total_orders > 0 else (100 if total_orders > 0 else 0)
            )
            revenue_change = (
                ((total_revenue - prev_total_revenue) / prev_total_revenue * 100)
                if prev_total_revenue > 0 else (100 if total_revenue > 0 else 0)
            )
            
            period_comparison = {
                "currentPeriod": {"orders": total_orders, "revenue": total_revenue},
                "previousPeriod": {"orders": prev_total_orders, "revenue": prev_total_revenue},
                "ordersChange": round(orders_change, 1),
                "revenueChange": round(revenue_change, 1),
                "periodDays": period_days
            }
        except Exception as e:
            logger.warning(f"Could not calculate period comparison: {e}")
    
    return {
        "totalOrders": total_orders,
        "totalRevenue": round(total_revenue, 2),
        "averageCheck": round(average_check, 2),
        "currency": currency,
        "topModels": top_models,
        "promotionStats": promotion_stats,
        "dailyStats": daily_stats,
        "employeeStats": employee_stats,
        "periodComparison": period_comparison,
    }


@router.get("/{calculator_type}/employees")
async def get_employees(calculator_type: str):
    """Get list of unique employees who created orders."""
    
    if calculator_type == "sauna":
        collection = db.sauna_orders
    elif calculator_type == "balia":
        collection = db.orders
    else:
        return []
    
    # Get distinct createdBy values
    orders = await collection.find({}, {"_id": 0, "createdBy": 1}).to_list(10000)
    employees = set()
    for order in orders:
        emp = order.get("createdBy")
        if emp:
            employees.add(emp)
    
    return sorted(list(employees))


@router.get("/{calculator_type}/export")
async def export_statistics(
    calculator_type: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    employee: Optional[str] = Query(None),
    format: str = Query("json", description="Export format: json or csv")
):
    """Export orders data for the given filters."""
    
    if calculator_type == "sauna":
        collection = db.sauna_orders
    elif calculator_type == "balia":
        collection = db.orders
    else:
        return {"error": "Invalid calculator type"}
    
    # Build query
    query = {}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        if date_filter:
            query["orderDate"] = date_filter
    
    if employee and employee != "all":
        query["createdBy"] = employee
    
    orders = await collection.find(query, {"_id": 0}).to_list(10000)
    
    if format == "csv":
        # Return CSV-ready data
        csv_data = []
        for order in orders:
            csv_data.append({
                "id": order.get("id", ""),
                "date": order.get("orderDate", ""),
                "customer": order.get("fullName", ""),
                "phone": order.get("phoneNumber", ""),
                "model": order.get("modelName", ""),
                "total": order.get("total", 0),
                "discount": order.get("discountPercent", 0),
                "employee": order.get("createdBy", ""),
            })
        return {"data": csv_data, "format": "csv"}
    
    return {"data": orders, "format": "json"}
