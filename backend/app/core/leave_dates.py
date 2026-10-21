from datetime import date, datetime, time

# Leave start and end dates are stored at midnight, which is what makes the
# whole "does this leave cover that day" question a plain timestamp comparison
# instead of a range query.


def day_covering_filters(value: date) -> dict:
    """Mongo filters matching leaves that cover the given day.

    A leave covers the day when it starts on or before it and ends on or
    after it, so a leave running 3rd to 9th matches both the 5th and the 9th
    and not the 2nd or the 10th. Both admin and employee lists need this, and
    both the paged query and its count have to agree on it or pagination drifts.
    """
    day_start = datetime.combine(value, time.min)

    return {
        "start_date": {"$lte": day_start},
        "end_date": {"$gte": day_start},
    }