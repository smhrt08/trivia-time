## Requirements for Trivia Game 

### Technical requirements 
- Run through github pages
- Host can send join link to connect contestants to game 

### Questions requirements 
- Each question should be displayed on its own page
- Each question page could contain one of the following:
  1. A text question with 4 multiple choice options
  2. A video player that will play a video clip
  3. A text question with a picture and 4 multiple choice options
- The questions should be able to be configured within the site page and saved there for future uses
- A reveal page for each question can be displayed and highlights the answer from the multiple choice options or the correct answer will be displayed

### Host mode requirements 
- A host needs to see different display on a different device but have it control navigation on another device 
- There needs to be navigation on the site to allow the user to navigate to specific questions and to the next question
- Host device is linked via host code
- Only 1 host is allowed
- Host can see all pages and navigate between them before updating the display
- Display update will happen via a button click
- Host can add and remove teams and edit their details
- Host has a scorecard that can be updated and submitted

### Contestant mode requirements 
- Contestants can submit a team name to the site
- Contestants can submit a team photo to the site
- Contestants can have a buzzer button for buzzing in for answers (e.g. Jeopardy) 

### End round requirements 
- After each round is scored by the host, scores are shown as a column graph for each team
- Y-axis has labels that are editable
- Y-axis lines are every 5 points
- X-axis has labels for each team name and picture (if applicable)

### Chase round requirements 
- Timer displays on the screen and counts down from start time
- Timer can be started and stopped by the host via the Spacebar key 
- Counter is displayed on screen starting at 0
- Counter can be manually incremented by the host via the Enter key
- Counter can be manually decremented by the host via the Delete key
- Counter has chunks as a percentage of the total (e.g. 2 chunks are 50%, 5 chunks are each 20%, etc.)
- First team gets their count saved, the timer can be reset but the count remains on the screen
- A second team goes and has their own counter display below the first team's counter
- Only the active counter can be edited by the host 
