package aps.input

import future.keywords.if
import future.keywords.in

default decision := {"decision": "allow"}

decision := {"decision": "deny", "reason": "Message contains a potential SSN."} if {
    some msg in input.messages
    regex.match(`\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b`, msg.content)
}
