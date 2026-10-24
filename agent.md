# Codex Agent Instructions: PC Build Advisor

## Product goal

Build a web app that turns a customer’s budget and computing needs into a researched, compatible PC build plan. The agent may offer an optional contractor path for assembly, but the core demo ends with a quote and a parts list. Do not imply that Terac can supply a local PC assembler unless that capability and availability have been confirmed.

## Technology choices

- **Agent orchestration:** OpenAI Agents SDK. Start with one coordinator agent that calls focused tools; do not build a multi-agent system unless a concrete need emerges.
- **Human review:** Terac MCP, used to request feedback on a proposed build when useful. Treat review as general feedback unless the task specifically recruits a verified PC hardware expert.
- **Product research:** Exa, connected as an MCP server or wrapped as an API tool, for current retailer/product pages.
- **Payment:** Whop checkout for a paid build plan or consultation. Use test mode or a clearly labeled simulation in the demo.
- **Frontend and backend:** Follow the existing repository’s stack. If this is a new repo, choose the simplest stack already familiar to the team. Keep agent tools and API credentials on the server.

## Customer workflow

1. Collect the customer’s:
   - Budget and currency.
   - Primary use: gaming, workstation, streaming, general use, or another workload.
   - Target resolution and performance goals when relevant.
   - Existing parts to reuse.
   - Preferences such as size, appearance, noise, Wi-Fi, operating system, and retailer.
   - Country or ZIP/postal code only when needed for regional pricing or availability.
2. Summarize the request and let the customer correct it.
3. Create a proposed parts list with current source links and prices.
4. Check compatibility and budget. Explain assumptions and tradeoffs.
5. Request Terac feedback if an appropriate reviewer is available. Ask specific questions about the build’s fit for the customer’s use case, budget, and preferences. Do not describe a general reviewer as a certified builder.
6. Revise the list when feedback is useful and consistent with verified specifications and customer constraints.
7. Present a quote and build plan. Offer an optional assembly or contractor-interest path only if configured; clearly state that it is a separate service and availability must be confirmed.
8. Use Whop to collect payment for the configured product. Confirm payment from Whop before marking an order paid or unlocking paid deliverables.

## Agent design

Create a `PC Build Coordinator` agent with tools for:

- `collect_build_requirements`: validate and store the customer brief; ask for missing critical details.
- `search_parts_exa`: find relevant part listings and source pages using Exa.
- `verify_part_specs`: extract or check model identifiers, dimensions, socket/memory standards, power requirements, and other compatibility facts from reliable source pages.
- `check_build_compatibility`: apply deterministic compatibility rules to a structured parts list. Do not rely on language-model judgment alone for hard constraints.
- `request_terac_review`: submit an anonymized build and narrowly scoped questions to Terac; return the task status and reviewer response.
- `create_whop_checkout`: create a checkout for the configured build-plan product.
- `get_whop_payment_status`: verify payment before fulfillment.
- `create_contractor_request`: optional stub or integration for an assembly quote. Keep disabled unless the team has confirmed a provider, service area, price, and task workflow.

The coordinator decides when to search again, when to ask the customer a question, and whether human review is worth the delay or cost. Keep a traceable record of sources, tool results, decisions, and any reviewer feedback used.

## Research and compatibility rules

- Search for real products and retailer pages. Store product name, exact model/SKU when available, retailer, URL, listed price, currency, retrieval timestamp, and relevant specifications.
- Never invent prices, availability, benchmarks, compatibility, discounts, or product links.
- Prefer manufacturer specifications for technical compatibility and retailer pages for current price and availability. Mark unresolved details as unverified.
- Check at minimum: CPU and motherboard socket/chipset support; memory type and capacity; motherboard and case form factor; GPU length and slot clearance; cooler height or radiator fit; PSU wattage and connectors; storage interface; and case/motherboard headers when relevant.
- Include an appropriate power and thermal margin. If a required specification is missing, do not silently assume it fits; ask the customer or present a clearly labeled assumption.
- Include shipping/tax only when sourced or supplied. Separate known costs from estimates, and keep the quote within budget when possible.
- Do not purchase components or commit the customer to a retailer order. Provide links so the customer can review and buy.

## Terac review rules

- Use Terac for human judgment that can improve the plan, not as a substitute for technical validation.
- Send only the minimum needed: anonymized customer requirements, parts list, budget, and explicit review questions. Do not send names, contact details, or unrelated data.
- Ask whether the parts list is understandable and whether the tradeoffs suit the stated use case. For technical compatibility review, require a task that verifies PC hardware expertise; otherwise label the result as general feedback.
- A Terac response is feedback, not proof that a component is compatible or available. Verify factual claims against manufacturer or retailer sources.
- If no suitable reviewer is available or the MCP is unavailable, continue with a sourced agent plan and state that no human review occurred.

## Whop and demo rules

- Keep Whop credentials and payment operations server-side.
- Use a test checkout or clearly labeled simulated checkout for the demo unless a real payment product is deliberately configured.
- Never collect or store card details in the app.
- Do not claim payment, contractor booking, part reservation, or order placement succeeded without confirmation from the relevant provider.
- Seed a demo request and sample results so the judges can complete the flow without payment or a real assembly booking. Label seeded content as demo data.

## Suggested output schema

```json
{
  "status": "intake | researching | awaiting_review | quoted | checkout_pending | paid | needs_customer_input",
  "customer_brief": {
    "budget": null,
    "currency": "USD",
    "use_case": "",
    "performance_goal": "",
    "existing_parts": [],
    "preferences": [],
    "region": null
  },
  "parts": [
    {
      "category": "",
      "name": "",
      "model": "",
      "retailer": "",
      "url": "",
      "price": null,
      "currency": "USD",
      "key_specs": {},
      "source_checked_at": "",
      "availability": "confirmed | unconfirmed | unavailable"
    }
  ],
  "estimated_subtotal": null,
  "shipping_estimate": null,
  "tax_estimate": null,
  "estimated_total": null,
  "compatibility_check": {
    "status": "pass | issues | incomplete",
    "checks": [],
    "unverified_items": []
  },
  "terac_review": {
    "requested": false,
    "reviewer_qualification": "general | verified_hardware_expert | unknown",
    "completed": false,
    "feedback_summary": "",
    "changes_made": []
  },
  "assembly_option": {
    "enabled": false,
    "availability": "not_configured | quote_available | unavailable",
    "estimated_labor": null
  },
  "assumptions": [],
  "customer_questions": []
}
```

## Definition of done

- A customer can enter requirements and receive a usable build plan.
- Every recommended part has a source link and price status.
- Deterministic checks catch major incompatibilities and show unresolved checks.
- The plan stays within budget or explains the smallest necessary tradeoff.
- Terac feedback is shown accurately and causes a visible revision when appropriate.
- Whop test/simulated checkout is represented honestly.
- The demo works without a live order, payment, or physical assembly.
