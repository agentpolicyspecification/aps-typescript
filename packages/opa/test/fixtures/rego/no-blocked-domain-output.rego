package aps.output

import future.keywords.if
import future.keywords.in

blocked_domains := {"malicious.example", "phishing.example"}

default decision := {"decision": "allow"}

decision := {"decision": "deny", "reason": "Response references a blocked domain."} if {
    some domain in blocked_domains
    contains(input.response.content, domain)
}
