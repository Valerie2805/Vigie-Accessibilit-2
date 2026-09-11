import { AppShell } from '@/components/AppShell';

const sections = [
  {
    title: '1. Identification du vendeur',
    paragraphs: [
      "Les presentes Conditions Generales de Vente s'appliquent aux prestations proposees sous la marque Zyrelka par Valerie Renier, entrepreneur individuel.",
      'Raison sociale : Valerie Renier',
      'Forme juridique : Entrepreneur individuel',
      'Nom commercial : Zyrelka',
      'SIRET : 789 903 465 00027',
      'Adresse du siege : 4 rue Jean Renoir, 76530 Grand Couronne',
      'Email de contact : contact@zyrelka.com',
      'Telephone : 07 88 75 30 62',
      'TVA : TVA non applicable, art. 293 B du CGI',
    ],
  },
  {
    title: '2. Objet',
    paragraphs: [
      "Les presentes CGV definissent les conditions dans lesquelles Zyrelka fournit a ses clients professionnels des prestations liees a la detection automatisee de signaux d'accessibilite web, a la realisation de pre-audits, audits techniques ou revues d'accessibilite selon le perimetre convenu, ainsi qu'a la qualification, la structuration, la priorisation des resultats et la constitution de bases de prospection ou de livrables associes.",
      "Les prestations exactes fournies au client sont celles decrites dans le devis, la proposition commerciale, le bon de commande ou tout autre document contractuel emis par Zyrelka.",
    ],
  },
  {
    title: "3. Champ d'application",
    paragraphs: [
      "Les presentes CGV s'appliquent a toute commande de prestation passee par un client professionnel.",
      "Toute commande implique l'acceptation pleine et entiere des presentes CGV, sauf conditions particulieres convenues par ecrit entre les parties.",
      "En cas de contradiction entre les CGV et un devis ou une proposition commerciale signee, le devis ou la proposition commerciale prevaut pour le perimetre qu'il couvre.",
    ],
  },
  {
    title: '4. Nature des prestations',
    paragraphs: [
      "Les prestations de Zyrelka peuvent inclure des analyses automatisees, des traitements de donnees, des restitutions, des recommandations et, selon les cas, une intervention humaine de verification, de priorisation ou d'interpretation.",
      "Sauf mention expresse contraire, les resultats automatisees constituent des indicateurs, signaux, scores, resumes ou lectures de priorite et ne constituent pas a eux seuls une certification, une garantie de conformite ou un avis juridique.",
      "Lorsque Zyrelka emploie les termes audit, pre-audit, analyse, evaluation ou revue, ces termes s'entendent dans le perimetre strictement defini dans les documents contractuels applicables.",
    ],
  },
  {
    title: '5. Commande',
    paragraphs: [
      "La commande est reputee ferme a reception d'un devis signe avec la mention Bon pour accord, d'un bon de commande valide, d'un accord ecrit clair du client ou du paiement de l'acompte lorsque celui-ci est prevu.",
      "Zyrelka se reserve le droit de refuser ou suspendre une commande en cas d'information insuffisante, d'impossibilite technique ou materielle, de risque manifeste de non-paiement ou de demande manifestement illicite.",
    ],
  },
  {
    title: '6. Prix',
    paragraphs: [
      "Les prix sont exprimes en euros. Sauf mention contraire, ils sont indiques hors taxes et la TVA applicable est ajoutee selon le regime fiscal en vigueur.",
      "Si le vendeur releve de la franchise en base, la mention legale appropriee est portee sur les documents commerciaux.",
      "Les prix applicables sont ceux mentionnes dans le devis ou la proposition commerciale acceptee par le client. Toute prestation supplementaire non prevue au devis initial fera l'objet d'une validation prealable et, le cas echeant, d'une facturation complementaire.",
    ],
  },
  {
    title: '7. Modalites de paiement',
    paragraphs: [
      "Les modalites de paiement sont celles indiquees dans le devis ou sur la facture. Sauf stipulation contraire, un acompte peut etre demande a la commande et le solde est payable a reception de facture ou selon l'echeancier convenu.",
      "En cas de retard de paiement, des penalites de retard peuvent etre appliquees conformement aux dispositions legales en vigueur. Pour les clients professionnels, une indemnite forfaitaire pour frais de recouvrement peut egalement etre due dans les conditions prevues par la loi.",
    ],
  },
  {
    title: '8. Delais et execution',
    paragraphs: [
      "Les delais de realisation indiques par Zyrelka sont donnes a titre estimatif, sauf engagement express contraire.",
      "Les delais courent a compter de la validation complete de la commande, de la reception des elements necessaires a la mission et, le cas echeant, du paiement de l'acompte.",
      "Zyrelka ne pourra etre tenue responsable des retards lies notamment a une information manquante du client, a une indisponibilite de services tiers, a une indisponibilite technique de sites, plateformes, API, navigateurs distants, hebergements ou outils externes, ou a un cas de force majeure.",
    ],
  },
  {
    title: '9. Obligations du client',
    paragraphs: [
      "Le client s'engage a fournir des informations exactes, suffisantes et actualisees, a transmettre dans les delais les elements utiles a la mission et a verifier qu'il dispose des droits, autorisations ou bases legitimes necessaires sur les donnees, contenus, sites ou fichiers qu'il communique.",
      "Le client demeure seul responsable de l'usage commercial, contractuel ou juridique qu'il fait des livrables, des decisions prises sur la base des resultats fournis et du respect de ses propres obligations legales et reglementaires.",
    ],
  },
  {
    title: '10. Donnees, outils tiers et dependances externes',
    paragraphs: [
      "Certaines prestations peuvent reposer en tout ou partie sur des outils, services ou plateformes tiers. Zyrelka ne garantit pas la disponibilite continue de ces services, l'absence d'erreur de leur part ni l'exhaustivite des donnees qu'ils retournent.",
      "Lorsque des resultats proviennent en tout ou partie d'un traitement automatise ou d'une source tierce, ils doivent etre interpretes comme des elements d'aide a la lecture, a la priorisation ou a la prospection, et non comme des certitudes absolues.",
    ],
  },
  {
    title: '11. Livrables et propriete intellectuelle',
    paragraphs: [
      "Sauf mention contraire, les livrables remis au client sont destines a son usage interne ou a l'usage convenu contractuellement.",
      "Les methodes, modeles, structures, outils, composants, scripts, moteurs, canevas, documents types et savoir-faire utilises ou developpes par Zyrelka demeurent sa propriete exclusive, sauf cession expresse ecrite.",
    ],
  },
  {
    title: '12. Confidentialite',
    paragraphs: [
      "Chaque partie s'engage a conserver confidentielles les informations non publiques de l'autre partie auxquelles elle aurait acces dans le cadre de la relation contractuelle.",
    ],
  },
  {
    title: '13. Responsabilite',
    paragraphs: [
      "Zyrelka est tenue a une obligation de moyens.",
      "Sa responsabilite ne saurait etre engagee en cas de mauvaise interpretation des livrables par le client, d'utilisation des livrables en dehors de leur finalite, de decision prise par le client sur la seule base des livrables, d'indisponibilite ou d'erreur d'un outil tiers, ou de dommage indirect, perte d'exploitation, perte de chance, perte de clientele, perte de donnees ou prejudice commercial.",
      "En tout etat de cause, sauf faute lourde ou dolosive, la responsabilite totale de Zyrelka est limitee au montant hors taxes effectivement percu au titre de la prestation concernee.",
    ],
  },
  {
    title: "14. Limites relatives aux analyses d'accessibilite",
    paragraphs: [
      "Le client reconnait qu'une detection automatisee ne couvre pas l'ensemble des situations d'accessibilite, que certains constats necessitent une verification humaine et que les formulations de type signaux detectes, points a confirmer, exposition estimee, priorisation ou lecture de risque ne valent ni qualification juridique ni certification.",
      "Sauf engagement specifique exprime dans un devis distinct, les prestations de Zyrelka ne constituent pas une mission de conseil juridique.",
    ],
  },
  {
    title: '15. Prospection et enrichissement de donnees',
    paragraphs: [
      "Lorsque la prestation comprend la constitution ou l'enrichissement de listes de prospection, Zyrelka agit dans le cadre d'une prestation technique ou operationnelle definie avec le client.",
      "Le client reste seul responsable de la base legale de ses traitements, du respect des regles applicables a la prospection et du respect du RGPD et, plus generalement, des regles de protection des donnees et de demarchage.",
    ],
  },
  {
    title: '16. Force majeure',
    paragraphs: [
      "Aucune partie ne pourra etre tenue responsable d'un manquement cause par un evenement de force majeure ou tout evenement echappant raisonnablement a son controle, empechant ou retardant l'execution normale de ses obligations.",
    ],
  },
  {
    title: '17. Suspension ou resiliation',
    paragraphs: [
      "En cas de manquement grave par l'une des parties a ses obligations, non remedie dans un delai raisonnable apres notification ecrite, l'autre partie pourra suspendre ou resilier la relation contractuelle, sous reserve des sommes deja dues au titre des prestations realisees.",
    ],
  },
  {
    title: '18. Droit applicable et litiges',
    paragraphs: [
      "Les presentes CGV sont soumises au droit francais.",
      "En cas de litige, les parties s'efforceront de rechercher une solution amiable avant toute action judiciaire.",
      "A defaut d'accord amiable, competence expresse est attribuee aux juridictions territorialement competentes selon les regles de droit commun, sauf disposition legale imperative contraire.",
    ],
  },
];

export default function LegalCgvPage() {
  return (
    <AppShell
      eyebrow="Mentions contractuelles"
      title="Conditions generales de vente"
      description="Conditions generales de vente de Zyrelka, editees par Valerie Renier, entrepreneur individuel."
    >
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
        <div className="rounded-[24px] border border-copper/30 bg-copper/10 p-5 text-sm leading-7 text-ivory-muted">
          Ces CGV sont publiees sur le site pour rendre les conditions contractuelles accessibles
          a tout client ou prospect avant commande.
        </div>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-[24px] border border-white/10 bg-ink-soft p-5"
            >
              <h2 className="font-display text-2xl text-ivory">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-ivory-muted">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
