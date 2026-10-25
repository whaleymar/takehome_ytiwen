# Open questions for the sales team

## Contradictions in the sample data

For now the app trusts the structured columns over `special_requirements` notes.

1. **"Must be in business at least 6 months before applying"** never matters, because every program with this note already requires 1+ years in `min_years_in_business`:
   - Pacific Commerce Bank – Community Advantage (1 yr)
   - Evergreen Business Capital – Community Advantage (1 yr)
   - Coastal Capital – Community Advantage (2 yrs)
   - Summit Lending Group – 7(a) Standard (2 yrs)
   - Sterling Business Lending – 7(a) Standard (2 yrs)
   - Heritage Credit Union – 7(a) Standard (3 yrs)

   Is the 6-month figure correct and the years column wrong, or the other way around?
2. **"Requires business plan for startups"** appears on programs that don't accept startups:
   - Keystone Community Bank – Community Advantage (min 2 yrs)
   - Sterling Business Lending – Community Advantage (min 1 yr)
3. **Credit tier and minimum score overlap.** A 640 minimum is labeled "Good" for First National Bank and Pacific Commerce Bank (7(a) Small Loan), but "Fair" for Keystone Community Bank (Community Advantage). What score range does each tier (Fair / Good / Excellent) mean? The app treats tier and exact score as separate checks.
4. **Real-estate-only notes on programs that usually aren't for real estate:**
   - Summit Lending Group – Community Advantage: "Real estate purchase only"
   - Gateway Commercial Finance – 7(a) Small Loan: "Real estate purchase only"
   - Gateway Commercial Finance – SBA Express: "Owner-occupied real estate only"
   - Frontier Capital Group – 7(a) Standard: "Owner-occupied real estate only"

   Are these right? If loan purpose matters this often, should it be a filter?
5. **SBA guarantee on 7(a) Standard** is 85% at Heritage, Coastal, Gateway, and Frontier, but 75% everywhere else. The real SBA rule depends on loan size (85% up to $150K, 75% above). Should the guarantee depend on the borrower's loan amount instead of being a fixed number?

## What the data means

6. When a program lists a single business type (e.g. "Manufacturing"), is that the **only** type allowed, or the lender's specialty? The app currently treats it as the only one.
7. Collateral **"Varies"**: what does it depend on? Can reps tell the borrower anything more specific?
8. Blank **max existing debt ratio** (11 programs): no limit, or unknown? It shows as "Not specified".
9. Are rates fixed or variable? What decides where a borrower lands within the rate range?
10. Reps sometimes know **revenue**, but the CSV has no revenue column. Do any lenders have revenue requirements we should capture?
11. `last_updated` is a single date, but rates change monthly and terms change quarterly. Do we need separate dates for rate changes and term changes?

## Feature questions

12. **Stale rates:** could a program ever go a month or more without an update, so that a "rates may be outdated — confirm with lender" warning would be useful? (This sample is old, so it can't tell us.)
13. **Monthly payment estimate** (from loan amount, rate, and term) on each card: would reps quote it to borrowers?
14. **Rate history:** would reps use "rate went from X to Y" information, or is a "New rates" badge for the last 7 days enough?
15. **Sharing with borrowers:** what should a borrower see when a rep shares a comparison? Should the shared view be a frozen copy (the rates the borrower was quoted) or always show current rates? Should internal-only details be hidden?
16. **Manager reporting:** what counts as a rep "recommending" a program: opening it, sharing it, or something else?
