import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

    const supabaseUrl = 'https://pedtyonlklzbyikiywru.supabase.co'
    const supabaseKey = 'sb_publishable_oLffRxc_yv8J4ZDTuSSPXw_wQtNye15'

    const supabase = createClient(supabaseUrl, supabaseKey)


    async function deleteAllGames() {
      const { data, error } = await supabase
        .from('Game')
        .delete()
        .neq('id', 0) // This condition is to prevent deleting all records if the table is empty

        if (error) {
            console.error('Error deleting games:', error)
        } else {
            console.log('All games deleted successfully')
        }
    }




    const gamesData = [
  {
    "name": "Chess",
    "min_players": 2,
    "max_players": 2
  },
  {
    "name": "Catan",
    "min_players": 3,
    "max_players": 4
  },
  {
    "name": "Carcassonne",
    "min_players": 2,
    "max_players": 5
  },
  {
    "name": "Pandemic",
    "min_players": 2,
    "max_players": 4
  },
  {
    "name": "Codenames",
    "min_players": 2,
    "max_players": 8
  }
]


    async function addDataset() {
      await deleteAllGames()
      
      for (const game of gamesData) {
        const { error } = await supabase
          .from('Game')
          .insert([game])
        
        if (error) {
          console.error('Error adding game:', error)
        } else {
          console.log(`Game "${game.name}" added successfully`)
        }
      }
    }

    document.getElementById('datasetBtn').addEventListener('click', addDataset)
    