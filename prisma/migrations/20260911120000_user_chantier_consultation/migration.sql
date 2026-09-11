-- Extra chantiers granted to a user in read-only (consultation) mode
CREATE TABLE "UserChantierConsultation" (
    "userId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,

    CONSTRAINT "UserChantierConsultation_pkey" PRIMARY KEY ("userId","chantierId")
);

CREATE INDEX "UserChantierConsultation_chantierId_idx" ON "UserChantierConsultation"("chantierId");

ALTER TABLE "UserChantierConsultation" ADD CONSTRAINT "UserChantierConsultation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserChantierConsultation" ADD CONSTRAINT "UserChantierConsultation_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
