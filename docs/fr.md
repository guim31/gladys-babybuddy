# Baby Buddy

Le suivi des soins de votre [Baby Buddy](https://docs.baby-buddy.net) dans
Gladys : depuis combien de temps le dernier repas et la dernière couche, si le
bébé dort, combien de sommeil aujourd'hui. Un bouton près du lit note une
couche ou lance et arrête le minuteur de sommeil ou de repas, une scène vous
prévient quand un repas tarde.

> **Vos retours sont les bienvenus.** Cette intégration a été testée contre un
> vrai serveur Baby Buddy (image Docker `lscr.io/linuxserver/babybuddy`,
> octobre 2026), pas encore avec un vrai Gladys au quotidien. Si quelque chose
> ne marche pas comme décrit, dites-le sur le
> [forum Gladys](https://community.gladysassistant.com) ou dans les
> [issues](https://github.com/guim31/gladys-babybuddy/issues).

## Ce qu'il faut

- Gladys Assistant 5.1.0 ou plus récent.
- Un **Baby Buddy auto-hébergé**, joignable depuis Gladys (l'image Docker
  écoute sur le port 8000).
- La **clé d'API** d'un utilisateur de Baby Buddy : dans Baby Buddy, ouvrez le
  menu utilisateur (en haut à droite) → **API key**, et copiez les 40
  caractères. Les entrées écrites depuis Gladys le sont au nom de cet
  utilisateur.

## Configuration

1. Dans Gladys, **Intégrations** → installez **Baby Buddy**.
2. Dans l'écran **Configuration**, renseignez :
   - **Adresse** : l'adresse de Baby Buddy, par exemple
     `http://192.168.1.20:8000`, ou `https://bebe.example.org` derrière un
     proxy inverse (un préfixe de chemin comme `/babybuddy` est gardé) ;
   - **Clé d'API** : la clé de votre utilisateur Baby Buddy.
3. Options :
   - **Type** et **Méthode d'un repas arrêté depuis Gladys** : Baby Buddy exige
     les deux pour enregistrer un repas ; ils servent quand un minuteur de
     repas est arrêté depuis Gladys (lait maternel, les deux seins par défaut).
     Corrigez l'entrée dans Baby Buddy ensuite si besoin ;
   - **Unité de poids** et **Unité de température** : Baby Buddy enregistre
     des nombres sans unité, indiquez celles que vous utilisez (kilogrammes et
     Celsius par défaut) ;
   - **Accepter les certificats auto-signés** : pour une adresse en
     `https://` au certificat auto-signé, sur votre propre serveur seulement ;
   - **Intervalle de rafraîchissement** : 1, 2 ou 5 minutes (1 par défaut).
     Les compteurs de minutes avancent chaque minute quel que soit
     l'intervalle ;
   - **Langue des noms de fonctionnalités** : les noms donnés aux
     fonctionnalités à l'ajout d'un appareil (français par défaut), les noms
     des minuteurs lancés depuis Gladys et les textes envoyés aux scènes.
4. Enregistrez, puis **Tester la connexion** : elle lit Baby Buddy et donne le
   nombre d'enfants et de minuteurs en cours.
5. Dans l'onglet **Découverte**, ajoutez les appareils : un par enfant.

## Appareils

**Baby Buddy _prénom_**, un par enfant, avec ces fonctionnalités :

| Fonctionnalité              | Ce qu'elle indique                                                    |
| --------------------------- | --------------------------------------------------------------------- |
| `Depuis le dernier repas`   | minutes depuis la fin du dernier repas                                |
| `Repas aujourd'hui`         | repas commencés aujourd'hui                                           |
| `Repas en cours`            | 1 tant qu'un minuteur de repas tourne                                 |
| `Depuis la dernière couche` | minutes depuis le dernier change                                      |
| `Couches aujourd'hui`       | changes de couche aujourd'hui                                         |
| `Dort`                      | 1 tant qu'un minuteur de sommeil tourne                               |
| `Sommeil aujourd'hui`       | minutes de sommeil enregistrées aujourd'hui (depuis minuit)           |
| `Température`               | la dernière température prise                                         |
| `Poids`                     | le dernier poids, en texte (`4,85 kg`) : Gladys n'a pas de type poids |

Un **minuteur** compte comme sommeil ou repas d'après son nom : ceux lancés
depuis Gladys s'appellent `Sommeil` et `Repas` (dans la langue des noms), et
un minuteur nommé par exemple `Sieste`, `Dodo`, `Biberon` ou `Tétée` dans Baby
Buddy compte aussi. Un minuteur sans nom ne compte pour aucun des deux.
« Aujourd'hui » est le jour dans le fuseau horaire de Gladys. La température
est une « température de l'appareil », pour que les 37,5 °C d'un enfant ne
deviennent pas la température de la chambre dans Gladys.

## Tableau de bord

Le widget **Baby Buddy** montre, pour un enfant (le premier, ou celui choisi
dans les réglages du widget) :

- trois tuiles : le temps depuis le dernier repas (`…` pendant un minuteur de
  repas), depuis la dernière couche, et le sommeil du jour ;
- l'état : dort depuis quand, repas en cours ou heure du dernier repas,
  dernière couche et son type ;
- quatre boutons : **Couche mouillée**, **Couche sale**, **Début sommeil** /
  **Réveil**, **Début repas** / **Fin repas**. Un bouton fait ce qu'il affiche :
  un widget pas à jour ne relance jamais un minuteur qu'il montre en cours.

## Scènes

### Déclencheurs

- **Pas de repas depuis un moment** : part une fois par repas quand le nombre
  d'heures choisi (1 à 8) est passé depuis sa fin. Filtres : l'enfant (vide :
  n'importe lequel) et le nombre d'heures. Rien ne part pendant qu'un minuteur
  de repas tourne. Informations transmises aux actions : le prénom de
  l'enfant, les heures, les minutes depuis le dernier repas, la fin du dernier
  repas.

Au démarrage de l'intégration, ce qui est déjà en retard est connu, pas
nouveau : elle part à la prochaine heure franchie. Après une panne, les heures
franchies entre-temps partent quand Baby Buddy répond de nouveau.

### Actions

- **Noter une couche** : écrit un change de couche mouillée, sale, ou mouillée
  et sale pour un enfant, maintenant. Résultats : le prénom de l'enfant, le
  type.
- **Minuteur de sommeil ou de repas** : démarre, arrête ou bascule (démarre
  s'il est arrêté, arrête s'il tourne) le minuteur de sommeil ou de repas d'un
  enfant. Arrêté, le minuteur devient une entrée de sommeil ou de repas dans
  Baby Buddy, de son début à maintenant. Démarrer un minuteur qui tourne, ou
  n'en arrêter aucun, ne change rien. Résultats : le prénom de l'enfant, si le
  minuteur tourne, la durée enregistrée (minutes).

### Idées de scènes

- Un bouton Zigbee près du lit : un appui lance **Minuteur de sommeil ou de
  repas** avec _Sommeil_ et _Démarrer ou arrêter_ ; un double appui lance
  **Noter une couche** avec _Mouillée_.
- **Pas de repas depuis un moment** à 3 heures, la nuit : une lumière douce
  dans la chambre et un message sur le téléphone.
- Quand `Dort` passe à 1 : baisser la lumière de la chambre et allumer
  l'enceinte à bruit blanc ; quand il repasse à 0, ouvrir un peu les volets.

## Dépannage

- **« Baby Buddy ne répond pas »** : vérifiez l'adresse et le port depuis la
  machine de Gladys (`http://<adresse>:8000` ouvre Baby Buddy dans un
  navigateur).
- **« Clé d'API refusée »** : recopiez la clé depuis le menu utilisateur de
  Baby Buddy (elle change si elle est régénérée).
- **« Aucune API Baby Buddy à cette adresse »** : quelque chose répond, mais pas
  Baby Buddy : vérifiez le port, ou le préfixe de chemin derrière un proxy
  inverse.
- **« L'adresse redirige »** : saisissez l'adresse en `https://`.
- **« Une autre entrée couvre déjà ce moment »** : Baby Buddy refuse deux
  repas (ou deux sommeils) en même temps. Le minuteur est gardé : corrigez les
  entrées dans Baby Buddy, puis arrêtez de nouveau le minuteur.
- **Un minuteur n'est pas vu comme sommeil ou repas** : donnez-lui un nom avec
  le mot (`Sommeil`, `Sieste`, `Repas`, `Biberon`, ou leurs équivalents
  anglais, allemands ou espagnols).
- Journaux : `LOG_LEVEL=debug` sur le conteneur montre chaque lecture.

## Limites

- Baby Buddy est lu toutes les 1 à 5 minutes : une entrée écrite dans Baby
  Buddy apparaît dans Gladys dans ce délai. Chaque lecture fait 2 requêtes,
  plus 5 par enfant.
- L'intégration lit les 50 dernières entrées de chaque type par enfant : de
  quoi couvrir une journée. Tire-lait, temps sur le ventre, médicaments, notes
  et mesures autres que poids et température ne sont pas lus.
- Elle n'écrit que des changes de couche et des minuteurs de sommeil et de
  repas ; elle ne modifie ni ne supprime jamais une entrée.
- Le déclencheur « Pas de repas depuis un moment » est gardé en mémoire : une
  heure franchie pendant que l'intégration est arrêtée n'est pas annoncée
  ensuite.
- Gladys ne garde aucune donnée de Baby Buddy dans le conteneur (`/data` reste
  vide).
- Sans lien avec Baby Buddy.
