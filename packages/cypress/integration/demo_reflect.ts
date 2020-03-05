function addCard(column, text) {
  cy.get(`[data-cy=phase-item-editor-${column}-wrapper]`)
      .as('column-phase-item-editor')
    
  cy.get('@column-phase-item-editor')
    .type(`${text}`)
    .should('have.text', `${text}`)

  cy.get('@column-phase-item-editor')
    .type('{enter}')
  
  cy.wait(500)

}

function editCard(column, oldText, newText) {
  cy.get(`[data-cy=reflection-stack-${column}-card-0-wrapper]`)
    .as('reflection-card-edit')

  cy.get('@reflection-card-edit')
    .should('have.text', `${oldText}`)

  cy.get('@reflection-card-edit')
    .type('{selectall}').type('{backspace}').type(`${newText}`)
    .should('have.text', `${newText}`)

}

function deleteCard(column) {
      
  cy.get(`[data-cy=reflection-stack-${column}-card-0-delete]`)
    .as('reflection-card-delete')

  cy.get('@reflection-card-delete').click()
}

describe('Test Reflect page Demo', () => {

  before(function() {
    // runs before each test in the block
    cy.visit('/retrospective-demo/reflect')
    cy.get('[data-cy=start-demo-button]').should('be.visible').click().then(() => {
      cy.get('[data-cy=sidebar-header]').find('button').should('be.visible').click()
    })


  })

  it.skip('Test help menu toggle', () => {

    cy.get('[data-cy=help-menu-toggle]').should('be.visible')
    
    cy.get('[data-cy=help-menu-close]').should('be.visible').click()

    cy.get('[data-cy=help-menu-close]').should('not.exist')
    
    cy.get('[data-cy=help-menu-toggle]').should('be.visible').click().get('[data-cy=help-menu-close]').should('be.visible')


  })

  it.skip('Test adding, editing, and deleting reflections', () => {

    addCard('Start', 'Start column reflection')

    addCard('Stop', 'Stop column reflection')

    addCard('Continue', 'Continue column reflection')

    editCard('Start', 'Start column reflection', 'Edit reflection')

    editCard('Stop', 'Stop column reflection', 'Edit reflection')

    editCard('Continue', 'Continue column reflection', 'Edit reflection')
  
    deleteCard('Start')

    deleteCard('Stop')

    deleteCard('Continue')
  })

  it('Test if can advance to groups', () => {

    cy.get('[data-cy=next-Group]:not(:disabled)').should('be.visible').click()

    cy.url().should('be.eq', 'http://localhost:3000/retrospective-demo/group')
  })

})