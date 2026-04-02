package aps.tool_call

import future.keywords.if
import future.keywords.in

approved_tools := {"web_search", "read_file", "summarize"}

default decision := {"decision": "deny", "reason": "Tool is not in the approved list."}

decision := {"decision": "allow"} if {
    input.tool_name in approved_tools
}
