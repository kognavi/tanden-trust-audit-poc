# Loop 017 SHA-256-first: independent Reviewer

Result: **PASS for local design and implementation, conditional; AWS deployment NO-GO**.

The verifier requires an externally approved full commit SHA that equals a clean Git HEAD, then checks the committed template and IAM policy against the reviewed provenance and verifies the full bytes of the two separately downloaded S3 objects. It requires the S3 get-object receipts' non-null VersionIds for provenance. Focused tests pass (3/3), including tampered bytes, missing VersionId, unreviewed HEAD and dirty Git; `git diff --check` and all current artifact digests pass.

The mechanical IAM delta removes only the template URL's `?versionId=NCd4Nwob4IzIBElxVNiSFu8g_o2l5Xlr` and `s3:GetObjectVersion` on the exact two keys. The template removes only the CodeZip `VersionId` field. Account, Region, exact PassRole, tags/CodeZip digest, no-VPC, `ResourceTypes` and dependent FAS conditions are unchanged. The versionless template hashes to `53817314deb0cad92a4dd5a852f00ad142b5576c55d5f9f2f52eff1de09581b2`, unlike the previously uploaded version; a new upload under separate approval and successful read-back is mandatory.

Independent writers to either exact key could change the latest version after verification. `ResourceTypes` does not restrict Runtime count or properties. Review write-capable identities and establish a no-write period through service reads; otherwise use the VersionId-pinned design. This is a review of code/docs, not approval to upload, apply IAM or deploy. No AWS call was made during review.
