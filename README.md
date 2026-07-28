# Alambicco — Puzzle di distillazione

PWA di water-sort puzzle, in italiano, con livelli infiniti generati proceduralmente.

## Come pubblicarla su GitHub Pages

1. Crea un nuovo repository su GitHub (qualsiasi nome va bene: tutti i percorsi nel
   `manifest.json` e nel `sw.js` sono **relativi**, quindi non serve modificarli).
2. Carica nella **root** del repository tutti questi file mantenendo la struttura:
   ```
   index.html
   style.css
   app.js
   manifest.json
   sw.js
   icons/
     icon-192.png
     icon-512.png
     icon-maskable-512.png
   ```
   Importante: le icone devono restare dentro la sottocartella `icons/`.
3. Vai in **Settings → Pages** del repository, seleziona il branch `main` e la cartella
   `/ (root)`, salva.
4. Dopo un minuto l'app sarà live all'indirizzo che GitHub Pages ti mostra.
5. Aprendola da smartphone (Chrome/Safari) comparirà l'opzione "Aggiungi a schermata Home"
   per installarla come app.

## Come funziona il gioco

- Ogni livello viene generato al volo con un algoritmo deterministico (stesso livello =
  stesso puzzle ogni volta) e verificato da un piccolo risolutore interno prima di essere
  mostrato: è sempre garantito risolvibile.
- La difficoltà cresce con il numero di sostanze (colori) da 4 a 12, mentre le provette
  vuote restano sempre 2 per garantire generazione rapida e affidabile.
- Stelle: 3 se risolvi con un numero di mosse vicino all'ottimo trovato dal risolutore,
  2 se entro 1,5×, 1 comunque al completamento.
- Il progresso (livello raggiunto, stelle, punteggio, statistiche, impostazioni) è salvato
  in `localStorage` sul dispositivo.

Miki × Claude
